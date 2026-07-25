// CDN-first static content client.
// Flow: manifest → IndexedDB (fresh?) → HTTP → hydrate IDB.
// On 404, self-heal by asking static-generate to repair the missing file, then retry once.
//
// Payload shape written by supabase/functions/static-generate:
//   { v: <version>, generated_at: iso, data: <T> }

import { STATIC_CDN } from './staticFlags';
import { idbGet, idbPut, idbBulkPrune, idbKeys } from './idbCache';
import { supabase } from '@/integrations/supabase/client';

interface Envelope<T> {
  v: number;
  generated_at: string;
  data: T;
}

export interface Manifest {
  version: number;
  entities: Record<string, number>;
  /** V3: paths deleted since the previous manifest — clients evict them. */
  tombstones?: string[];
}

let manifestPromise: Promise<Manifest | null> | null = null;
let manifestFetchedAt = 0;
let lastPrunedVersion = 0;
const MANIFEST_TTL_MS = 30_000; // in-memory SWR window
const healedThisSession = new Set<string>();

function url(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${STATIC_CDN.base}/${clean}`;
}

export async function getManifest(force = false): Promise<Manifest | null> {
  const now = Date.now();
  if (!force && manifestPromise && now - manifestFetchedAt < MANIFEST_TTL_MS) {
    return manifestPromise;
  }
  manifestFetchedAt = now;
  manifestPromise = (async () => {
    try {
      const res = await fetch(url('manifest.json'), { cache: 'no-store' });
      if (!res.ok) return null;
      const m = (await res.json()) as Manifest;
      // On a version bump, prune IDB entries that are no longer in the manifest.
      if (m && m.version && m.version !== lastPrunedVersion) {
        lastPrunedVersion = m.version;
        try {
          const valid = new Set(Object.keys(m.entities ?? {}));
          const keys = await idbKeys();
          const stale = keys.filter((k) => !valid.has(k));
          if (stale.length > 0) await idbBulkPrune(valid);
        } catch { /* ignore */ }
        // V3: process explicit tombstones (belt-and-braces on top of the
        // manifest diff — covers the case where a client fetches the same
        // manifest version twice but the previous prune failed).
        if (Array.isArray(m.tombstones) && m.tombstones.length > 0) {
          try {
            for (const t of m.tombstones) await idbDelete(t);
          } catch { /* ignore */ }
        }
        // Fire a DOM event so hooks can invalidate their in-memory copies.
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent('p4no:manifest-updated', { detail: m }));
          } catch { /* ignore */ }
        }
      }
      return m;
    } catch {
      return null;
    }
  })();
  return manifestPromise;
}

function entityFromPath(path: string): { entity: string; slug?: string; category?: string } | null {
  const p = path.replace(/^\/+/, '').replace(/\.json$/, '');
  if (p.startsWith('product/')) return { entity: 'product', slug: p.slice('product/'.length) };
  if (p.startsWith('service/')) return { entity: 'service', slug: p.slice('service/'.length) };
  if (p.startsWith('article/')) return { entity: 'article', slug: p.slice('article/'.length) };
  if (p.startsWith('products/category/')) return { entity: 'category', category: p.slice('products/category/'.length) };
  if (p.startsWith('products/')) return { entity: 'product' };
  if (p.startsWith('services/')) return { entity: 'service' };
  if (p.startsWith('reels/')) return { entity: 'reel' };
  if (p.startsWith('articles/')) return { entity: 'article' };
  if (p.startsWith('categories/')) return { entity: 'category' };
  return null;
}

async function selfHeal(path: string): Promise<boolean> {
  if (healedThisSession.has(path)) return false;
  healedThisSession.add(path);
  const target = entityFromPath(path);
  if (!target) return false;
  try {
    await supabase.functions.invoke('static-generate', { body: target });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch a static JSON payload with IDB caching.
 * Returns null if the CDN has never generated this path AND nothing is cached.
 */
export async function getStatic<T = unknown>(path: string): Promise<T | null> {
  if (!STATIC_CDN.base) return null;

  const cleanPath = path.replace(/^\/+/, '').replace(/\.json$/, '');
  const manifest = await getManifest();
  const expectedVersion = manifest?.entities?.[cleanPath] ?? 0;

  const cached = await idbGet<Envelope<T>>(cleanPath);
  if (cached && expectedVersion && cached.version === expectedVersion) {
    return (cached.data as unknown as Envelope<T>).data ?? (cached.data as unknown as T);
  }

  // Fetch fresh (with ETag from cached version).
  try {
    const res = await fetch(url(`${cleanPath}.json`), {
      headers: cached ? { 'If-None-Match': `"v${cached.version}"` } : undefined,
    });
    if (res.status === 304 && cached) {
      return (cached.data as unknown as Envelope<T>).data ?? (cached.data as unknown as T);
    }
    if (res.status === 404) {
      // Self-heal: ask the generator to build the missing file, then retry once.
      const healed = await selfHeal(cleanPath);
      if (healed) {
        try {
          const retry = await fetch(url(`${cleanPath}.json`), { cache: 'no-store' });
          if (retry.ok) {
            const env = (await retry.json()) as Envelope<T>;
            await idbPut(cleanPath, env, env.v ?? Date.now());
            return env.data;
          }
        } catch { /* ignore */ }
      }
      if (cached) return (cached.data as unknown as Envelope<T>).data ?? (cached.data as unknown as T);
      return null;
    }
    if (!res.ok) {
      if (cached) return (cached.data as unknown as Envelope<T>).data ?? (cached.data as unknown as T);
      return null;
    }
    const env = (await res.json()) as Envelope<T>;
    await idbPut(cleanPath, env, env.v ?? expectedVersion ?? Date.now());
    return env.data;
  } catch {
    if (cached) return (cached.data as unknown as Envelope<T>).data ?? (cached.data as unknown as T);
    return null;
  }
}
