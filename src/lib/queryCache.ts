// Shared client-side query cache.
//
// Purpose: kill duplicate PostgREST reads produced by real user traffic.
// Two problems it solves:
//   1. Duplicate in-flight requests — several components mounting the same hook
//      each fire their own SELECT. `single-flight` collapses them into one.
//   2. Repeat requests across navigations/tabs — a TTL-backed localStorage layer
//      serves the previous answer without touching the network.
//
// This is deliberately dependency-free and synchronous-friendly so it can wrap
// any promise-returning fetcher (Supabase, edge function, third-party API).

interface Entry<T> {
  v: T;
  t: number;
}

const inflight = new Map<string, Promise<unknown>>();
const memory = new Map<string, Entry<unknown>>();

const PREFIX = 'p4no_qc:';

function readPersisted<T>(key: string, ttlMs: number): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const e = JSON.parse(raw) as Entry<T>;
    if (!e || typeof e.t !== 'number') return undefined;
    if (Date.now() - e.t > ttlMs) return undefined;
    return e.v;
  } catch {
    return undefined;
  }
}

function writePersisted<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, t: Date.now() } as Entry<T>));
  } catch {
    /* quota / private mode — memory cache still applies */
  }
}

export interface CachedQueryOptions {
  /** How long the answer stays fresh. Default 5 minutes. */
  ttlMs?: number;
  /** Persist across reloads/tabs in localStorage. Default true. */
  persist?: boolean;
}

/**
 * Run `fetcher` at most once per key per TTL window, sharing one in-flight
 * promise between all concurrent callers.
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  { ttlMs = 5 * 60_000, persist = true }: CachedQueryOptions = {},
): Promise<T> {
  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem && Date.now() - mem.t <= ttlMs) return mem.v;

  if (persist) {
    const stored = readPersisted<T>(key, ttlMs);
    if (stored !== undefined) {
      memory.set(key, { v: stored, t: Date.now() });
      return stored;
    }
  }

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const p = (async () => {
    try {
      const value = await fetcher();
      memory.set(key, { v: value, t: Date.now() });
      if (persist) writePersisted(key, value);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/** Drop a cached key (call after a mutation that invalidates it). */
export function invalidateQuery(key: string): void {
  memory.delete(key);
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/** Read the cached value without triggering a fetch. */
export function peekQuery<T>(key: string, ttlMs = 5 * 60_000): T | undefined {
  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem && Date.now() - mem.t <= ttlMs) return mem.v;
  return readPersisted<T>(key, ttlMs);
}
