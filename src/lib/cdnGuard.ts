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
import { isStaticPathAllowed } from './featureFlags';
import { supabase } from '@/integrations/supabase/client';
import { recordTraffic } from './trafficTelemetry';
import { guardFallback, markMissing, isKnownMissing, clearMissing } from './stampede';


// Exponential backoff for self-heal retries after 404.
const HEAL_RETRIES = [800, 2000, 4500] as const;

// Transient-network retries for the CDN fetch itself (cold-start protection).
const NET_RETRIES = [250, 700] as const;

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

// Visitor traffic must never start a generation run. Regeneration happens only
// from content mutations (DB triggers → static-worker) or explicit admin action.
function selfHealEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as unknown as { __P4NO_SELFHEAL__?: boolean }).__P4NO_SELFHEAL__ === true;
}

async function tryRegenerate(entity: string, slug?: string): Promise<boolean> {
  if (!selfHealEnabled()) return false;
  try {
    await supabase.functions.invoke('static-generate', {
      body: slug ? { entity, slug } : { entity },
    });
    return true;
  } catch { return false; }
}


function entityFromPath(path: string): { entity: string; slug?: string } | null {
  const p = path.replace(/^\/+/, '').replace(/\.json$/, '');
  if (p.startsWith('products/') || p === 'products' || p.startsWith('product/')) {
    // V3 sharded detail: products/<shard>/<slug>
    const sharded = p.match(/^products\/[0-9a-f]{2}\/(.+)$/);
    if (sharded) return { entity: 'product', slug: sharded[1] };
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

// -------------------- Layer 1: in-process memory --------------------

interface MemEntry { data: unknown; version: number; at: number }
const memory = new Map<string, MemEntry>();
const MEMORY_TTL_MS = 60_000;
const MEMORY_MAX = 300;

function memPut(key: string, data: unknown, version: number) {
  if (memory.size >= MEMORY_MAX) {
    const oldest = memory.keys().next().value as string | undefined;
    if (oldest) memory.delete(oldest);
  }
  memory.set(key, { data, version, at: Date.now() });
}

/** Approximate payload size without re-serialising huge structures twice. */
function approxBytes(v: unknown): number {
  try { return JSON.stringify(v)?.length ?? 0; } catch { return 0; }
}

/** True when the browser served the URL from its own HTTP cache (L2). */
function servedFromBrowserCache(url: string): boolean {
  try {
    const entries = performance.getEntriesByName(url) as PerformanceResourceTiming[];
    const last = entries[entries.length - 1];
    return !!last && last.transferSize === 0 && last.decodedBodySize > 0;
  } catch {
    return false;
  }
}

/**
 * Resolution outcome for the last completed read of a path.
 *  hit         → payload delivered (any layer)
 *  missing     → origin answered 404 and no cached copy exists → genuinely absent
 *  unavailable → network/CORS/abort/timeout, or CDN 5xx → delivery failed, product
 *                existence is UNKNOWN (must never render "not found")
 *  blocked     → feature flag disabled this path
 */
export type ResolveOutcome = 'hit' | 'missing' | 'unavailable' | 'blocked';

const outcomes = new Map<string, ResolveOutcome>();
const OUTCOME_MAX = 500;

function setOutcome(key: string, o: ResolveOutcome) {
  if (outcomes.size >= OUTCOME_MAX) {
    const oldest = outcomes.keys().next().value as string | undefined;
    if (oldest) outcomes.delete(oldest);
  }
  outcomes.set(key, o);
}

/** Outcome of the last resolution attempt for a static path. */
export function getLastOutcome(path: string): ResolveOutcome | undefined {
  return outcomes.get(path.replace(/^\/+/, '').replace(/\.json$/, ''));
}

/** Layered read + why it ended the way it did (used by detail pages). */
export async function getContentResolved<T = unknown>(
  path: string,
  opts: GetContentOptions<T> = {},
): Promise<{ data: T | null; outcome: ResolveOutcome }> {
  const data = await getContent<T>(path, opts);
  const key = path.replace(/^\/+/, '').replace(/\.json$/, '');
  const outcome = outcomes.get(key) ?? (data != null ? 'hit' : 'unavailable');
  return { data, outcome };
}

/** True when the manifest published by the generator lists this path. */
export async function isPathPublished(path: string): Promise<boolean | null> {
  const key = path.replace(/^\/+/, '').replace(/\.json$/, '');
  const m = await getManifest();
  if (!m) return null; // manifest itself unavailable → unknown
  return !!m.entities?.[key];
}

/**
 * Layered fetcher — the ONLY sanctioned way to read static content.
 * memory → browser HTTP cache → IndexedDB → CDN → database (last resort).
 */
export async function getContent<T = unknown>(
  path: string,
  opts: GetContentOptions<T> = {},
): Promise<T | null> {
  // Feature guard: a disabled module fetches nothing at all — no CDN request,
  // no IndexedDB read, no Supabase fallback.
  if (!isStaticPathAllowed(path)) {
    setOutcome(path.replace(/^\/+/, '').replace(/\.json$/, ''), 'blocked');
    return null;
  }

  if (!STATIC_CDN.base) {
    // No CDN configured — use fallback directly, mark as supabase.
    return runFallback(path, opts.fallback);
  }



  const key = path.replace(/^\/+/, '').replace(/\.json$/, '');

  // L1 — memory
  const mem = memory.get(key);
  if (mem && Date.now() - mem.at < MEMORY_TTL_MS) {
    recordTraffic({ path: key, layer: 'memory', bytes: 0, ms: 0, at: Date.now() });
    setOutcome(key, 'hit');
    return unwrap<T>(mem.data);
  }

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
      memPut(key, cached.data, cached.version);
      record({ path: key, source: 'browser', ms: Date.now() - started, status: 200, at: Date.now() });
      recordTraffic({ path: key, layer: 'idb', bytes: 0, ms: Date.now() - started, at: Date.now() });
      setOutcome(key, 'hit');
      return payload;
    }


    // 2b) MANIFEST AUTHORITY — the published manifest is the source of truth for
    //     existence. When it loaded successfully and does not list this key, the
    //     file is definitively absent: skip the CDN fetch entirely.
    //
    //     This matters because the static origin serves 404s WITHOUT CORS headers,
    //     so a missing file makes `fetch` reject with a TypeError instead of
    //     returning status 404. Without this gate the guard spent the network
    //     retries plus the 404 self-heal backoff (~7s per path) and still ended up
    //     classifying a genuine miss as "unavailable" — which is exactly what made
    //     product pages hang and then show "Taking longer than usual".
    const manifestUsable = !!manifest && !!manifest.entities && Object.keys(manifest.entities).length > 0;
    if (manifestUsable && !expectedVersion && !cached) {
      setOutcome(key, 'missing');
      markMissing(key);
      recordTraffic({
        path: key,
        layer: 'memory',
        bytes: 0,
        ms: Date.now() - started,
        at: Date.now(),
        missReason: 'manifest-not-published',
      });
      if (isStrictStaticMode()) {
        const meta = entityFromPath(key);
        if (meta) void tryRegenerate(meta.entity, meta.slug);
        return null;
      }
      return runFallback<T>(key, opts.fallback);
    }

    // 3) CDN fetch (L2 browser HTTP cache is transparently in front of it).
    //    Transient failures (network error / 5xx) are retried before we ever
    //    conclude anything about whether the content exists.
    let lastError = false;

    try {
      const url = cdnUrl(key);
      let res: Response | null = null;
      for (let attempt = 0; attempt < NET_RETRIES.length + 1; attempt++) {
        try {
          res = await fetch(url, {
            headers: cached ? { 'If-None-Match': `"v${cached.version}"` } : undefined,
          });
          if (res.status < 500) break;
        } catch {
          res = null;
        }
        lastError = true;
        if (attempt < NET_RETRIES.length) {
          await new Promise((r) => setTimeout(r, NET_RETRIES[attempt]));
        }
      }
      if (!res) throw new Error('cdn-unreachable');
      const ms = Date.now() - started;

      if (res.status === 304 && cached) {
        record({ path: key, source: 'cdn', ms, status: 304, at: Date.now() });
        recordTraffic({ path: key, layer: 'browser', bytes: 0, ms, at: Date.now(), missReason: 'idb-version-stale' });
        memPut(key, cached.data, cached.version);
        setOutcome(key, 'hit');
        return unwrap<T>(cached.data);
      }

      if (res.ok) {
        const env = (await res.json()) as Envelope<T> | T;
        const payload = unwrap<T>(env);
        const version = (env as Envelope<T>)?.v ?? expectedVersion ?? Date.now();
        await idbPut(key, env, version);
        memPut(key, env, version);
        record({ path: key, source: 'cdn', ms, status: res.status, at: Date.now() });
        recordTraffic({
          path: key,
          layer: servedFromBrowserCache(url) ? 'browser' : 'cdn',
          bytes: approxBytes(env),
          ms,
          at: Date.now(),
          missReason: cached ? 'version-bump' : 'cold-cache',
        });
        setOutcome(key, 'hit');
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
                memPut(key, env, version);
                record({ path: key, source: 'blob', ms: Date.now() - started, status: retry.status, at: Date.now() });
                recordTraffic({ path: key, layer: 'cdn', bytes: approxBytes(env), ms: Date.now() - started, at: Date.now(), missReason: 'regenerated-404' });
                setOutcome(key, 'hit');
                return payload;
              }
            } catch { /* keep retrying */ }
          }
        }
      }

      // 5) Stale IDB → return it while we recover
      if (cached) {
        record({ path: key, source: 'browser', ms, status: 200, at: Date.now() });
        recordTraffic({ path: key, layer: 'idb', bytes: 0, ms, at: Date.now(), missReason: 'stale-while-missing' });
        setOutcome(key, 'hit');
        return unwrap<T>(cached.data);
      }

      // A 404 from the origin is the ONLY evidence that content is absent.
      // Anything else (5xx, blocked, unreachable) leaves existence unknown.
      setOutcome(key, res.status === 404 && !lastError ? 'missing' : 'unavailable');

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
        setOutcome(key, 'hit');
        return unwrap<T>(cached.data);
      }
      setOutcome(key, 'unavailable');
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
    recordTraffic({ path, layer: 'db', bytes: 0, ms: 0, at: Date.now(), missReason: 'no-static-no-fallback' });
    return null;
  }
  // Stampede protection: one database fallback per path per cooldown window,
  // concurrent callers share the same query, breaker opens after repeat failures.
  if (isKnownMissing(path)) {
    recordTraffic({ path, layer: 'memory', bytes: 0, ms: 0, at: Date.now(), missReason: 'negative-cache' });
    return null;
  }
  try {
    const guarded = await guardFallback<T>(path, fn);
    const out = guarded.value;
    if (!guarded.allowed) {
      recordTraffic({ path, layer: 'memory', bytes: 0, ms: 0, at: Date.now(), missReason: `fallback-${guarded.reason}` });
      return out;
    }
    if (out === null || out === undefined) markMissing(path);
    record({
      path,
      source: 'supabase',
      ms: Date.now() - started,
      status: 200,
      violation: true,
      at: Date.now(),
    });
    recordTraffic({
      path,
      layer: 'db',
      bytes: approxBytes(out),
      ms: Date.now() - started,
      at: Date.now(),
      missReason: 'static-missing',
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
  memory.delete(key);
  await idbDelete(key);
}

/** Nuclear: wipe every cached static payload from IndexedDB. */
export async function repairIndexedDB(): Promise<void> {
  memory.clear();
  await idbClear();
  regenerated.clear();
}

/**
 * Warm a static path into the cache hierarchy without blocking the caller.
 * Used by the prefetch scheduler — never triggers a database read.
 */
export async function warmContent(path: string): Promise<void> {
  const key = path.replace(/^\/+/, '').replace(/\.json$/, '');
  if (memory.has(key) || inFlight.has(key)) return;
  try { await getContent(key); } catch { /* prefetch is best-effort */ }
}

/** True when a path is already resolvable from L1 memory. */
export function isWarm(path: string): boolean {
  const key = path.replace(/^\/+/, '').replace(/\.json$/, '');
  const m = memory.get(key);
  return !!m && Date.now() - m.at < MEMORY_TTL_MS;
}

// Content changed upstream → drop L1 so the next read revalidates.
if (typeof window !== 'undefined') {
  window.addEventListener('p4no:manifest-updated', () => {
    memory.clear();
    clearMissing();
  });
}


