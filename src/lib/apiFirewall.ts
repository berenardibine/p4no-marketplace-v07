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

const REST_MARKER = '/rest/v1/';
const POLLING_WINDOW_MS = 60_000;
const POLLING_THRESHOLD = 10; // >10 reads/min to same table = suspicious

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

function parseTable(url: string): string | null {
  const idx = url.indexOf(REST_MARKER);
  if (idx < 0) return null;
  const rest = url.slice(idx + REST_MARKER.length);
  const q = rest.indexOf('?');
  const path = q >= 0 ? rest.slice(0, q) : rest;
  // Path may be `table` or `rpc/fn_name`
  if (path.startsWith('rpc/')) return `rpc:${path.slice(4)}`;
  return path.split('/')[0] || null;
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
  totalReads = totalWrites = totalBlocked = totalMs = 0;
}