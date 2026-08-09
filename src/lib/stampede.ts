// Cache-stampede protection
// --------------------------
// A cache miss must never become a database traffic spike. This module is the
// shared primitive used by every static/CDN fetcher:
//
//   coalesce()        one in-flight operation per key; all other callers await it
//   negativeCache     confirmed-missing resources are remembered for a short TTL
//   guardFallback()   at most ONE Supabase fallback per key per cooldown window,
//                     plus a circuit breaker after repeated failures
//
// Pure in-memory, per tab. Nothing here reads or writes the database.

export interface StampedeCounters {
  coalesced: number;      // callers that reused an in-flight promise
  negativeHits: number;   // reads short-circuited by the negative cache
  fallbacksAllowed: number;
  fallbacksSuppressed: number;
  breakerOpen: number;    // reads refused while a breaker was open
}

const counters: StampedeCounters = {
  coalesced: 0,
  negativeHits: 0,
  fallbacksAllowed: 0,
  fallbacksSuppressed: 0,
  breakerOpen: 0,
};

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

export function subscribeStampede(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getStampedeStats(): StampedeCounters & { negativeSize: number; inFlight: number; openBreakers: string[] } {
  return {
    ...counters,
    negativeSize: negative.size,
    inFlight: inFlight.size,
    openBreakers: Array.from(breakers.entries())
      .filter(([, b]) => b.openUntil > Date.now())
      .map(([k]) => k),
  };
}

export function resetStampedeStats(): void {
  counters.coalesced = 0;
  counters.negativeHits = 0;
  counters.fallbacksAllowed = 0;
  counters.fallbacksSuppressed = 0;
  counters.breakerOpen = 0;
  notify();
}

// -------------------- in-flight coalescing --------------------

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Run `fn` at most once per key while it is in flight. 1,000 simultaneous
 * callers for the same resource produce exactly one origin operation.
 */
export function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    counters.coalesced += 1;
    notify();
    return existing as Promise<T>;
  }
  const p = (async () => fn())().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, p);
  return p;
}

export function isInFlight(key: string): boolean {
  return inFlight.has(key);
}

// -------------------- negative caching --------------------

const NEGATIVE_TTL_MS = 60_000;
const NEGATIVE_MAX = 500;
const negative = new Map<string, number>(); // key → expires-at

/** Remember that a resource is confirmed missing, so we stop asking for it. */
export function markMissing(key: string, ttlMs = NEGATIVE_TTL_MS): void {
  if (negative.size >= NEGATIVE_MAX) {
    const oldest = negative.keys().next().value as string | undefined;
    if (oldest) negative.delete(oldest);
  }
  negative.set(key, Date.now() + ttlMs);
}

/** True when this resource was recently confirmed missing. */
export function isKnownMissing(key: string): boolean {
  const until = negative.get(key);
  if (!until) return false;
  if (until <= Date.now()) {
    negative.delete(key);
    return false;
  }
  counters.negativeHits += 1;
  notify();
  return true;
}

export function clearMissing(key?: string): void {
  if (key) negative.delete(key);
  else negative.clear();
}

// -------------------- fallback protection / circuit breaker --------------------

interface Breaker {
  lastAt: number;
  failures: number;
  openUntil: number;
}

const FALLBACK_COOLDOWN_MS = 30_000; // one DB fallback per key per window
const BREAKER_FAILURES = 3;
const BREAKER_OPEN_MS = 60_000;

const breakers = new Map<string, Breaker>();
const lastResult = new Map<string, { value: unknown; at: number }>();

function breaker(key: string): Breaker {
  let b = breakers.get(key);
  if (!b) {
    b = { lastAt: 0, failures: 0, openUntil: 0 };
    breakers.set(key, b);
  }
  return b;
}

/**
 * Explicit, rate-limited database fallback.
 *
 * - coalesces concurrent callers onto one query
 * - refuses a repeat fallback inside the cooldown window (returns the last
 *   result if we have one, otherwise null)
 * - opens a circuit breaker after repeated failures
 *
 * Returns `{ value, allowed, reason }` so callers can log the fallback
 * explicitly instead of silently hammering PostgREST.
 */
export async function guardFallback<T>(
  key: string,
  fn: () => Promise<T | null>,
  opts: { cooldownMs?: number } = {},
): Promise<{ value: T | null; allowed: boolean; reason?: string }> {
  const now = Date.now();
  const b = breaker(key);

  if (b.openUntil > now) {
    counters.breakerOpen += 1;
    notify();
    return { value: (lastResult.get(key)?.value as T) ?? null, allowed: false, reason: 'breaker-open' };
  }

  const cooldown = opts.cooldownMs ?? FALLBACK_COOLDOWN_MS;
  const cached = lastResult.get(key);
  if (cached && now - cached.at < cooldown && !isInFlight(`fb:${key}`)) {
    counters.fallbacksSuppressed += 1;
    notify();
    return { value: cached.value as T, allowed: false, reason: 'cooldown' };
  }

  const value = await coalesce<T | null>(`fb:${key}`, async () => {
    counters.fallbacksAllowed += 1;
    notify();
    try {
      const out = await fn();
      b.failures = 0;
      b.lastAt = Date.now();
      lastResult.set(key, { value: out, at: Date.now() });
      return out;
    } catch (e) {
      b.failures += 1;
      b.lastAt = Date.now();
      if (b.failures >= BREAKER_FAILURES) b.openUntil = Date.now() + BREAKER_OPEN_MS;
      notify();
      throw e;
    }
  });

  return { value, allowed: true };
}

export function resetBreakers(): void {
  breakers.clear();
  lastResult.clear();
  notify();
}
