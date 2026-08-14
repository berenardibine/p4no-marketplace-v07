// P4NO API Request Firewall (V1 Performance Engine — Phase 3)
// -----------------------------------------------------------------
// A single fetch-level interceptor for the Supabase PostgREST endpoint.
// It does NOT change semantics for callers — it only measures and enforces:
//
//   • Per-table + per-verb call counters (session-scoped)
//   • Rolling 60s per-table hit tracking for polling detection
//   • Optional strict-mode blocking of public-table reads (via publicReadGuard)
//
// Why fetch-level? The Supabase JS client ultimately calls fetch() with a
// URL like `${SUPABASE_URL}/rest/v1/<table>?...`. Wrapping fetch gives us a
// single choke point that captures EVERY read the app makes — direct
// `supabase.from(...)`, third-party libs, dev-time debugging — without
// touching each hook. Auth/RPC/functions endpoints are ignored.
//
// Exposes `getApiFirewallStats()` for the Performance Center dashboard.

import { isStrictStaticMode } from './staticFlags';
import { isPublicTable } from './publicReadGuard';
import { markViolation } from './cdnGuard';
import { disabledFeatureTables } from './featureFlags';
import { recordTraffic, routeShape } from './trafficTelemetry';

const REST_MARKER = '/rest/v1/';
const FN_MARKER = '/functions/v1/';
const STORAGE_MARKER = '/storage/v1/';
const POLLING_WINDOW_MS = 60_000;
const POLLING_THRESHOLD = 10; // >10 reads/min to same table = suspicious

// Retired modules: tables that MUST receive zero traffic. Any hit is a defect
// and is surfaced in the Unified Traffic & Cache Monitor diagnostics.
const RETIRED_TABLES = new Set(['product_likes']);
interface RetiredHit { table: string; method: string; route: string; at: number; stack: string }
const retiredHits: RetiredHit[] = [];
const retiredCounts = new Map<string, number>();
const retiredListeners = new Set<() => void>();

export function subscribeRetiredTables(cb: () => void) {
  retiredListeners.add(cb);
  return () => { retiredListeners.delete(cb); };
}

/** Diagnostic: "Product Likes Requests" and any other retired-module traffic. */
export function getRetiredTableStats() {
  return {
    tables: Array.from(retiredCounts.entries()).map(([table, count]) => ({ table, count })),
    productLikesRequests: retiredCounts.get('product_likes') ?? 0,
    recent: retiredHits.slice(-20).reverse(),
  };
}

function recordRetired(table: string, method: string, route: string) {
  retiredCounts.set(table, (retiredCounts.get(table) ?? 0) + 1);
  retiredHits.push({
    table, method, route, at: Date.now(),
    stack: (new Error().stack || '').split('\n').slice(2, 6).join(' | '),
  });
  if (retiredHits.length > 100) retiredHits.shift();
  retiredListeners.forEach((cb) => { try { cb(); } catch { /* ignore */ } });
}

interface TableStat {
  table: string;
  reads: number;
  writes: number;
  blocked: number;
  totalMs: number;
  errors: number;
  hits: number[]; // rolling timestamps for polling detection
}

const tables = new Map<string, TableStat>();
let installed = false;
let totalReads = 0;
let totalWrites = 0;
let totalBlocked = 0;
let totalMs = 0;

function statFor(name: string): TableStat {
  let s = tables.get(name);
  if (!s) {
    s = { table: name, reads: 0, writes: 0, blocked: 0, totalMs: 0, errors: 0, hits: [] };
    tables.set(name, s);
  }
  return s;
}

type Endpoint =
  | { api: 'rest'; table: string; rpc: boolean }
  | { api: 'functions'; table: string }
  | { api: 'storage'; table: string };

/**
 * Every Supabase surface the app can touch is recognised here. Before this,
 * only `/rest/v1/` was visible, which made Edge Functions (e.g.
 * get-recommendations) and Storage completely invisible to telemetry.
 */
function parseEndpoint(url: string): Endpoint | null {
  const seg = (marker: string) => {
    const idx = url.indexOf(marker);
    if (idx < 0) return null;
    const rest = url.slice(idx + marker.length);
    const q = rest.indexOf('?');
    return q >= 0 ? rest.slice(0, q) : rest;
  };
  const rest = seg(REST_MARKER);
  if (rest !== null) {
    if (rest.startsWith('rpc/')) return { api: 'rest', table: `rpc:${rest.slice(4)}`, rpc: true };
    return { api: 'rest', table: rest.split('/')[0] || 'unknown', rpc: false };
  }
  const fn = seg(FN_MARKER);
  if (fn !== null) return { api: 'functions', table: `fn:${fn.split('/')[0] || 'unknown'}` };
  const st = seg(STORAGE_MARKER);
  if (st !== null) return { api: 'storage', table: `storage:${st.split('/').slice(0, 3).join('/')}` };
  return null;
}

function parseTable(url: string): string | null {
  const e = parseEndpoint(url);
  return e ? e.table : null;
}

/** Install the fetch interceptor once. Safe to call multiple times. */
export function installApiFirewall() {
  if (installed || typeof window === 'undefined') return;
  const orig = window.fetch.bind(window);
  installed = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const table = parseTable(url);

    if (!table) return orig(input, init);

    const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? (input as Request).method : 'GET')).toUpperCase();
    const isRead = method === 'GET' || method === 'HEAD';
    const stat = statFor(table);
    const started = Date.now();
    const now = started;

    // Rolling window tracking for polling detection
    stat.hits.push(now);
    const cutoff = now - POLLING_WINDOW_MS;
    while (stat.hits.length && stat.hits[0] < cutoff) stat.hits.shift();

    // Retired module guard: product_likes must never be touched again.
    if (RETIRED_TABLES.has(table)) {
      recordRetired(table, method, routeShape());
      stat.blocked += 1;
      totalBlocked += 1;
      markViolation(`rest:${table}`, 'retired-module');
      recordTraffic({
        path: `rest:${table}`, layer: 'db', bytes: 0, ms: 0, at: Date.now(),
        status: 200, route: routeShape(), resourceType: `retired:${table}`,
        missReason: 'retired-module',
      });
      return new Response(isRead ? '[]' : '{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Strict-mode block: refuse public-content reads at the network layer.
    if (isRead && isStrictStaticMode() && isPublicTable(table)) {
      stat.blocked += 1;
      totalBlocked += 1;
      markViolation(`rest:${table}`, 'firewall-blocked');
      // Return an empty PostgREST-compatible response so callers don't crash.
      return new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Feature Guard: a disabled module's exclusive tables get ZERO traffic
    // (reads AND writes), no matter which code path attempted the call.
    if (disabledFeatureTables().has(table)) {
      stat.blocked += 1;
      totalBlocked += 1;
      markViolation(`rest:${table}`, 'feature-disabled');
      return new Response(isRead ? '[]' : '{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const res = await orig(input, init);
      const ms = Date.now() - started;
      stat.totalMs += ms;
      totalMs += ms;
      if (isRead) { stat.reads += 1; totalReads += 1; }
      else { stat.writes += 1; totalWrites += 1; }
      if (!res.ok) stat.errors += 1;

      // REAL PostgREST accounting: every row this app READS from Supabase is a
      // L5 database delivery event, no matter which hook issued it. Writes are
      // mutations, not delivery, so they never pollute the cache-hit ratio.
      if (isRead) {
        try {
          const header = Number(res.headers.get('content-length') ?? 0);
          const emit = (bytes: number) =>
            recordTraffic({
              path: `rest:${table}`,
              layer: 'db',
              bytes,
              ms,
              at: Date.now(),
              status: res.status,
              route: routeShape(),
              resourceType: `table:${table}`,
              missReason: 'postgrest-read',
            });
          if (Number.isFinite(header) && header > 0) {
            emit(header);
          } else {
            // Chunked responses omit content-length: measure the real payload
            // from a clone so egress numbers are true, never estimated.
            void res
              .clone()
              .arrayBuffer()
              .then((buf) => emit(buf.byteLength))
              .catch(() => emit(0));
          }
        } catch { /* ignore */ }
      }
      return res;
    } catch (err) {
      stat.errors += 1;
      throw err;
    }
  };
}

export function getApiFirewallStats() {
  const rows = Array.from(tables.values());
  const top = rows
    .slice()
    .sort((a, b) => (b.reads + b.writes) - (a.reads + a.writes))
    .slice(0, 12)
    .map((s) => ({
      table: s.table,
      reads: s.reads,
      writes: s.writes,
      blocked: s.blocked,
      errors: s.errors,
      avgMs: s.reads + s.writes > 0 ? Math.round(s.totalMs / (s.reads + s.writes)) : 0,
      perMin: s.hits.length,
    }));
  const polling = rows
    .filter((s) => s.hits.length >= POLLING_THRESHOLD)
    .sort((a, b) => b.hits.length - a.hits.length)
    .slice(0, 10)
    .map((s) => ({ table: s.table, perMin: s.hits.length }));
  return {
    installed,
    totalReads,
    totalWrites,
    totalBlocked,
    totalMs,
    tables: rows.length,
    top,
    polling,
  };
}

export function resetApiFirewallStats() {
  tables.clear();
  retiredHits.length = 0;
  retiredCounts.clear();
  totalReads = totalWrites = totalBlocked = totalMs = 0;
}