// P4NO Data Access Manager (V1 Performance Engine)
// --------------------------------------------------
// Soft-migration wrapper around ad-hoc data fetches. Provides:
//   • Request deduplication (identical concurrent calls share one Promise)
//   • Short-window memory cache (default 30s) — repeat calls served from RAM
//   • Counters exported to the Performance Center dashboard
//
// It does NOT replace the static/CDN layer (see `cdnGuard.ts`). Use for
// non-static reads that would otherwise hit PostgREST repeatedly
// (dynamic per-user data, aggregates, admin views, etc.).
//
// Usage:
//   const rows = await dedupe(`orders:${userId}`, () => supabase.from(...));
//   const list = await cachedFetch(`wallet:${userId}`, () => fetchWallet(), 60_000);

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const memory = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const stats = {
  hits: 0,        // memory cache hits
  dedupes: 0,     // concurrent calls collapsed
  misses: 0,      // actual invocations of the fetcher
  saved: 0,       // hits + dedupes (requests prevented)
};

/** Get counters snapshot for the Performance Center. */
export function getDataAccessStats() {
  const total = stats.hits + stats.dedupes + stats.misses || 1;
  return {
    ...stats,
    hitRate: ((stats.hits + stats.dedupes) / total) * 100,
    entries: memory.size,
  };
}

export function resetDataAccessStats() {
  stats.hits = stats.dedupes = stats.misses = stats.saved = 0;
}

/**
 * Deduplicate concurrent calls under the same key.
 * Does NOT cache the result after resolution — use `cachedFetch` for that.
 */
export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) {
    stats.dedupes += 1;
    stats.saved += 1;
    return pending;
  }
  const p = (async () => {
    try {
      stats.misses += 1;
      return await fn();
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/**
 * Memory-cached fetch. Repeat calls within `ttlMs` return the cached value
 * (0 network). Concurrent misses share one in-flight promise.
 */
export async function cachedFetch<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = 30_000,
): Promise<T> {
  const entry = memory.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (entry && entry.expires > now) {
    stats.hits += 1;
    stats.saved += 1;
    return entry.value;
  }
  const value = await dedupe(key, fn);
  memory.set(key, { value, expires: now + ttlMs });
  return value;
}

/** Manually invalidate a cached key (e.g. after a mutation). */
export function invalidate(key: string) {
  memory.delete(key);
}

/** Invalidate every key that starts with the given prefix. */
export function invalidatePrefix(prefix: string) {
  for (const k of memory.keys()) {
    if (k.startsWith(prefix)) memory.delete(k);
  }
}

/** Clear the whole memory cache (rarely needed; auth logout, etc.). */
export function clearAll() {
  memory.clear();
}