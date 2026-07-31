// CDN Traffic Guard
// -----------------
// Single layered fetcher for static content:
//   IndexedDB (fresh vs manifest) → Vercel CDN → Blob 404? → Supabase fallback (one-shot)
// Every call is recorded to `cdn_metrics` via a batched beacon so the admin
// dashboard can show where traffic actually lands.
//
// Public API:
//   getContent<T>(path, { fallback? })
//   invalidateContent(path)
//   getGuardStats() / subscribeGuardStats()
//   markViolation(path, note?)
//
// Uses:  src/lib/staticFlags.ts, src/lib/idbCache.ts, src/lib/staticCDN.ts

import { STATIC_CDN, isStrictStaticMode } from './staticFlags';
import { idbGet, idbPut, idbDelete, idbClear } from './idbCache';
import { getManifest } from './staticCDN';
import { supabase } from '@/integrations/supabase/client';

// Exponential backoff for self-heal retries after 404.
const HEAL_RETRIES = [800, 2000, 4500] as const;

export type CDNSource = 'browser' | 'cdn' | 'blob' | 'supabase';

interface Envelope<T> {
  v: number;
  generated_at: string;
  data: T;
}

interface GuardEvent {
  path: string;
  source: CDNSource;
  ms: number;
  status: number;
  violation?: boolean;
  at: number;
}

// -------------------- Telemetry beacon --------------------

const BEACON_INTERVAL = 10_000;
const BEACON_MAX_BATCH = 40;
const RECENT_KEEP = 200;

const buffer: GuardEvent[] = [];
const recent: GuardEvent[] = [];
const listeners = new Set<() => void>();

const counters = {
  browser: 0,
  cdn: 0,
  blob: 0,
  supabase: 0,
  violations: 0,
  totalMs: 0,
  count: 0,
};

// Per-path stats for the Performance Center: top endpoints + polling detection.
interface PathStat {
  path: string;
  count: number;
  supabase: number;
  violations: number;
  lastMs: number;
  hits: number[]; // rolling timestamps (last 60s) for polling detection
}
const pathStats = new Map<string, PathStat>();
const POLLING_WINDOW_MS = 60_000;
const POLLING_THRESHOLD = 10; // >10 hits/min to the SAME path from ONE session = suspicious

function recordPathStat(evt: GuardEvent) {
  let s = pathStats.get(evt.path);
  if (!s) {
    s = { path: evt.path, count: 0, supabase: 0, violations: 0, lastMs: 0, hits: [] };
    pathStats.set(evt.path, s);
  }
  s.count += 1;
  s.lastMs = evt.ms;
  if (evt.source === 'supabase') s.supabase += 1;
  if (evt.violation) s.violations += 1;
  const now = evt.at;
  s.hits.push(now);
  // prune outside rolling window
  const cutoff = now - POLLING_WINDOW_MS;
  while (s.hits.length && s.hits[0] < cutoff) s.hits.shift();
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function record(evt: GuardEvent) {
  buffer.push(evt);
  recent.unshift(evt);
  if (recent.length > RECENT_KEEP) recent.length = RECENT_KEEP;

  counters[evt.source] = (counters[evt.source] || 0) + 1;
  if (evt.violation) counters.violations += 1;
  counters.totalMs += evt.ms;
  counters.count += 1;
  recordPathStat(evt);

  notify();
}

// Telemetry is OFF by default: writing every served path into `cdn_metrics`
// is itself PostgREST traffic. Enable per-session from the admin panel with
// `window.__P4NO_TELEMETRY__ = true` (or localStorage p4no_cdn_telemetry=1).
function telemetryEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof (window as any).__P4NO_TELEMETRY__ === 'boolean') return (window as any).__P4NO_TELEMETRY__;
  try { return localStorage.getItem('p4no_cdn_telemetry') === '1'; } catch { return false; }
}

async function flushBeacon() {
  if (buffer.length === 0) return;
  if (!telemetryEnabled()) { buffer.length = 0; return; }
  const batch = buffer.splice(0, BEACON_MAX_BATCH);
  try {
    await supabase.from('cdn_metrics').insert(
      batch.map((e) => ({
        path: e.path.slice(0, 200),
        source: e.source,
        ms: e.ms,
        status: e.status,
        violation: e.violation ?? false,
      })),
    );
  } catch {
    // Silently drop — telemetry must never break app UX.
  }
}

if (typeof window !== 'undefined') {
  // No polling loop: flush only when the tab is being backgrounded/closed,
  // and only when telemetry was explicitly enabled.
  const maybeFlush = () => { if (buffer.length > 0) void flushBeacon(); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') maybeFlush();
  });
  window.addEventListener('pagehide', maybeFlush);
}


export function subscribeGuardStats(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getGuardStats() {
  const total = counters.count || 1;
  // Top 10 endpoints by request count.
  const top = Array.from(pathStats.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((s) => ({
      path: s.path,
      count: s.count,
      supabase: s.supabase,
      violations: s.violations,
      lastMs: s.lastMs,
      perMin: s.hits.length,
    }));
  // Any path exceeding the polling threshold in the last 60s.
  const polling = Array.from(pathStats.values())
    .filter((s) => s.hits.length >= POLLING_THRESHOLD)
    .sort((a, b) => b.hits.length - a.hits.length)
    .slice(0, 10)
    .map((s) => ({ path: s.path, perMin: s.hits.length }));
  return {
    ...counters,
    avgMs: Math.round(counters.totalMs / total),
    browserPct: (counters.browser / total) * 100,
    cdnPct: (counters.cdn / total) * 100,
    blobPct: (counters.blob / total) * 100,
    supabasePct: (counters.supabase / total) * 100,
    recent: recent.slice(0, 50),
    top,
    polling,
  };
}

export function markViolation(path: string, _note?: string) {
  record({ path, source: 'supabase', ms: 0, status: 200, violation: true, at: Date.now() });
}

// -------------------- Manifest-aware background refresh --------------------

let lastManifestVersion = 0;
let lastManifestCheck = 0;
const MANIFEST_MIN_GAP_MS = 5 * 60_000;

async function refreshManifestQuietly() {
  const now = Date.now();
  if (now - lastManifestCheck < MANIFEST_MIN_GAP_MS) return;
  lastManifestCheck = now;
  const m = await getManifest(true);
  if (!m) return;
  if (m.version !== lastManifestVersion) {
    lastManifestVersion = m.version;
  }
}

if (typeof window !== 'undefined') {
  // Event-driven only — no timers. The manifest is re-checked when the user
  // returns to the tab, at most once every 5 minutes.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshManifestQuietly();
  });
}


// -------------------- Core fetcher --------------------

const inFlight = new Map<string, Promise<any>>();
const regenerated = new Set<string>(); // one-shot Supabase→regen guard

function cdnUrl(path: string): string {
  const clean = path.replace(/^\/+/, '').replace(/\.json$/, '');
  return `${STATIC_CDN.base}/${clean}.json`;
}

async function tryRegenerate(entity: string, slug?: string) {
  try {
    await supabase.functions.invoke('static-generate', {
      body: slug ? { entity, slug } : { entity },
    });
  } catch { /* ignore */ }
}

function entityFromPath(path: string): { entity: string; slug?: string } | null {
  const p = path.replace(/^\/+/, '').replace(/\.json$/, '');
  if (p.startsWith('products/') || p === 'products' || p.startsWith('product/')) {
    if (p.startsWith('product/')) return { entity: 'product', slug: p.slice('product/'.length) };
    return { entity: 'product' };
  }
  if (p.startsWith('services/') || p.startsWith('service/')) {
    if (p.startsWith('service/')) return { entity: 'service', slug: p.slice('service/'.length) };
    return { entity: 'service' };
  }
  if (p.startsWith('reels/') || p.startsWith('reel/')) {
    if (p.startsWith('reel/')) return { entity: 'reel', slug: p.slice('reel/'.length) };
    return { entity: 'reel' };
  }
  if (p.startsWith('articles/') || p.startsWith('article/')) {
    if (p.startsWith('article/')) return { entity: 'article', slug: p.slice('article/'.length) };
    return { entity: 'article' };
  }
  if (p.startsWith('categories/')) return { entity: 'category' };
  return null;
}

export interface GetContentOptions<T> {
  fallback?: () => Promise<T | null>;
}

/**
 * Layered fetcher — the ONLY sanctioned way to read static content.
 */
export async function getContent<T = unknown>(
  path: string,
  opts: GetContentOptions<T> = {},
): Promise<T | null> {
  // Feature guard: a disabled module fetches nothing at all — no CDN request,
  // no IndexedDB read, no Supabase fallback.
  if (!isStaticPathAllowed(path)) return null;

  if (!STATIC_CDN.base) {
    // No CDN configured — use fallback directly, mark as supabase.
    return runFallback(path, opts.fallback);
  }


  const key = path.replace(/^\/+/, '').replace(/\.json$/, '');
  if (inFlight.has(key)) return inFlight.get(key) as Promise<T | null>;

  const p = (async () => {
    const started = Date.now();

    // 1) Manifest → decide freshness
    const manifest = await getManifest();
    const expectedVersion = manifest?.entities?.[key] ?? 0;

    // 2) IDB hit
    const cached = await idbGet<any>(key);

    // If the manifest no longer lists this key (e.g. content was deleted upstream),
    // proactively purge stale IDB so we never serve a removed detail page.
    if (manifest && !manifest.entities?.[key] && cached) {
      await idbDelete(key);
    }

    if (cached && expectedVersion && cached.version === expectedVersion) {
      const payload = unwrap<T>(cached.data);
      record({ path: key, source: 'browser', ms: Date.now() - started, status: 200, at: Date.now() });
      return payload;
    }

    // 3) CDN fetch
    try {
      const res = await fetch(cdnUrl(key), {
        headers: cached ? { 'If-None-Match': `"v${cached.version}"` } : undefined,
      });
      const ms = Date.now() - started;

      if (res.status === 304 && cached) {
        record({ path: key, source: 'cdn', ms, status: 304, at: Date.now() });
        return unwrap<T>(cached.data);
      }

      if (res.ok) {
        const env = (await res.json()) as Envelope<T> | T;
        const payload = unwrap<T>(env);
        const version = (env as Envelope<T>)?.v ?? expectedVersion ?? Date.now();
        await idbPut(key, env, version);
        record({ path: key, source: 'cdn', ms, status: res.status, at: Date.now() });
        return payload;
      }

      if (res.status === 404) {
        // 4) Regenerate + retry CDN with exponential backoff (up to 3 tries)
        if (!regenerated.has(key)) {
          regenerated.add(key);
          const meta = entityFromPath(key);
          if (meta) await tryRegenerate(meta.entity, meta.slug);
          for (const delay of HEAL_RETRIES) {
            await new Promise((r) => setTimeout(r, delay));
            try {
              const retry = await fetch(cdnUrl(key), { cache: 'no-store' });
              if (retry.ok) {
                const env = (await retry.json()) as Envelope<T> | T;
                const payload = unwrap<T>(env);
                const version = (env as Envelope<T>)?.v ?? Date.now();
                await idbPut(key, env, version);
                record({ path: key, source: 'blob', ms: Date.now() - started, status: retry.status, at: Date.now() });
                return payload;
              }
            } catch { /* keep retrying */ }
          }
        }
      }

      // 5) Stale IDB → return it while we recover
      if (cached) {
        record({ path: key, source: 'browser', ms, status: 200, at: Date.now() });
        return unwrap<T>(cached.data);
      }

      // 6) STRICT mode: refuse Supabase fallback. Queue regen, log violation, return null.
      if (isStrictStaticMode()) {
        const meta = entityFromPath(key);
        if (meta) void tryRegenerate(meta.entity, meta.slug);
        record({ path: key, source: 'supabase', ms: Date.now() - started, status: 503, violation: true, at: Date.now() });
        return null;
      }

      // 7) Last resort: fallback (Supabase) — logged as violation
      return runFallback<T>(key, opts.fallback);
    } catch {
      if (cached) {
        record({ path: key, source: 'browser', ms: Date.now() - started, status: 200, at: Date.now() });
        return unwrap<T>(cached.data);
      }
      return runFallback<T>(key, opts.fallback);
    }
  })();

  inFlight.set(key, p);
  try {
    return await p;
  } finally {
    inFlight.delete(key);
  }
}

function unwrap<T>(v: any): T {
  if (v && typeof v === 'object' && 'data' in v && 'v' in v) return (v as Envelope<T>).data;
  return v as T;
}

async function runFallback<T>(path: string, fn?: () => Promise<T | null>): Promise<T | null> {
  const started = Date.now();
  if (!fn) {
    record({ path, source: 'supabase', ms: 0, status: 404, violation: true, at: Date.now() });
    return null;
  }
  try {
    const out = await fn();
    record({
      path,
      source: 'supabase',
      ms: Date.now() - started,
      status: 200,
      violation: true,
      at: Date.now(),
    });
    return out;
  } catch {
    record({
      path,
      source: 'supabase',
      ms: Date.now() - started,
      status: 500,
      violation: true,
      at: Date.now(),
    });
    return null;
  }
}

export async function invalidateContent(path: string): Promise<void> {
  const key = path.replace(/^\/+/, '').replace(/\.json$/, '');
  await idbDelete(key);
}

/** Nuclear: wipe every cached static payload from IndexedDB. */
export async function repairIndexedDB(): Promise<void> {
  await idbClear();
  regenerated.clear();
}

