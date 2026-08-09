// Enterprise Traffic Telemetry
// ----------------------------
// Accounts every public read against the delivery layer that actually served
// it, so the Enterprise Traffic Dashboard can prove that traffic growth lands
// on CDN/cache and not on PostgREST.
//
// Layers (highest → lowest):
//   memory   L1  in-process map (same tab, same session)
//   browser  L2  HTTP cache / 304 revalidation (transferSize === 0)
//   idb      L3  IndexedDB (manifest-fresh)
//   cdn      L4  static JSON fetched from the CDN edge
//   db       L5  PostgREST fallback  ← the only layer that costs egress
//
// Pure in-memory. Nothing here writes to the database.

import { recordBudgetEvent } from './requestBudget';
import { publishDelivery } from './telemetryBus';

export type TrafficLayer = 'memory' | 'browser' | 'idb' | 'cdn' | 'db';

export const LAYER_LABEL: Record<TrafficLayer, string> = {
  memory: 'Browser memory (L1)',
  browser: 'Browser HTTP cache (L2)',
  idb: 'IndexedDB (L3)',
  cdn: 'CDN edge (L4)',
  db: 'Database fallback (L5)',
};

export interface TrafficEvent {
  path: string;
  layer: TrafficLayer;
  bytes: number;
  ms: number;
  at: number;
  /** Why the request fell past the previous layer. */
  missReason?: string;
  /** HTTP-ish status of the delivery (200 by default). */
  status?: number;
  /** App route the request was made from (`/products/:slug` shape). */
  route?: string;
  /** product | service | category | article | manifest | table:<name> ... */
  resourceType?: string;
  /** Correlation id for the Live Request Inspector. */
  requestId?: string;
}

interface PathAgg {
  path: string;
  count: number;
  bytes: number;
  db: number;
  lastMs: number;
}

const RECENT_KEEP = 150;

const layerCount: Record<TrafficLayer, number> = { memory: 0, browser: 0, idb: 0, cdn: 0, db: 0 };
const layerBytes: Record<TrafficLayer, number> = { memory: 0, browser: 0, idb: 0, cdn: 0, db: 0 };
const missReasons = new Map<string, number>();
const paths = new Map<string, PathAgg>();
const recent: TrafficEvent[] = [];
const fallbackEvents: TrafficEvent[] = [];

let prefetchIssued = 0;
let prefetchUsed = 0;
let startedAt = Date.now();

const listeners = new Set<() => void>();

// useSyncExternalStore requires a stable snapshot reference between changes.
let cachedSnapshot: TrafficSnapshot | null = null;

function notify() {
  cachedSnapshot = null;
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}


export function subscribeTraffic(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Collapse a concrete URL into a route shape: /products/abc -> /products/:slug */
export function routeShape(pathname?: string): string {
  const p = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  return (
    p
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id')
      .replace(/^(\/(?:products?|services?|categories|category|insights?|articles?|reels?|shops?)\/)[^/]+.*$/i, '$1:slug')
      .replace(/\/$/, '') || '/'
  );
}

function inferResource(path: string): string {
  const p = path.replace(/^\/+/, '');
  if (p.startsWith('rest:') || p.startsWith('table:')) return p;
  const head = p.split('/')[0];
  return head || 'unknown';
}

function nextRequestId(): string {
  try { return crypto.randomUUID().slice(0, 8); } catch { return Math.random().toString(36).slice(2, 10); }
}

export function recordTraffic(evt: TrafficEvent): void {
  try { recordBudgetEvent(evt.layer, evt.bytes, evt.path); } catch { /* never break a read */ }
  if (!evt.requestId) evt.requestId = nextRequestId();
  if (!evt.route) evt.route = routeShape();
  if (!evt.resourceType) evt.resourceType = inferResource(evt.path);
  if (evt.status === undefined) evt.status = 200;
  try {
    publishDelivery({
      request_id: evt.requestId,
      at: evt.at,
      route: evt.route,
      path: evt.path,
      resource_type: evt.resourceType,
      layer: evt.layer,
      status: evt.status,
      latency_ms: evt.ms,
      bytes: Math.max(0, evt.bytes || 0),
      database_used: evt.layer === 'db',
      postgrest_used: evt.layer === 'db',
      hit: evt.layer !== 'db',
      miss_reason: evt.missReason,
    });
  } catch { /* telemetry must never break a read */ }
  layerCount[evt.layer] += 1;
  layerBytes[evt.layer] += Math.max(0, evt.bytes || 0);

  if (evt.missReason) {
    missReasons.set(evt.missReason, (missReasons.get(evt.missReason) ?? 0) + 1);
  }

  let agg = paths.get(evt.path);
  if (!agg) {
    agg = { path: evt.path, count: 0, bytes: 0, db: 0, lastMs: 0 };
    paths.set(evt.path, agg);
  }
  agg.count += 1;
  agg.bytes += Math.max(0, evt.bytes || 0);
  agg.lastMs = evt.ms;
  if (evt.layer === 'db') {
    agg.db += 1;
    fallbackEvents.unshift(evt);
    if (fallbackEvents.length > 50) fallbackEvents.length = 50;
  }

  recent.unshift(evt);
  if (recent.length > RECENT_KEEP) recent.length = RECENT_KEEP;

  notify();
}

export function recordPrefetch(used = false): void {
  if (used) prefetchUsed += 1;
  else prefetchIssued += 1;
  notify();
}

export function resetTraffic(): void {
  (Object.keys(layerCount) as TrafficLayer[]).forEach((k) => {
    layerCount[k] = 0;
    layerBytes[k] = 0;
  });
  missReasons.clear();
  paths.clear();
  recent.length = 0;
  fallbackEvents.length = 0;
  prefetchIssued = 0;
  prefetchUsed = 0;
  startedAt = Date.now();
  notify();
}

export interface TrafficSnapshot {
  total: number;
  layerCount: Record<TrafficLayer, number>;
  layerBytes: Record<TrafficLayer, number>;
  layerPct: Record<TrafficLayer, number>;
  cacheHitRatio: number;
  dbFallbackRatio: number;
  readsPerSession: number;
  egressPerSession: number;
  dbBytes: number;
  savedBytes: number;
  preventedReads: number;
  staticFilesServed: number;
  topPaths: PathAgg[];
  missReasons: { reason: string; count: number }[];
  fallbacks: TrafficEvent[];
  recent: TrafficEvent[];
  prefetchIssued: number;
  prefetchUsed: number;
  sinceMs: number;
}

/** Average uncompressed size of a PostgREST row payload we avoided fetching. */
const AVG_DB_PAYLOAD_BYTES = 1400;

export function getTrafficSnapshot(): TrafficSnapshot {
  if (cachedSnapshot) return cachedSnapshot;

  const total =
    layerCount.memory + layerCount.browser + layerCount.idb + layerCount.cdn + layerCount.db;
  const denom = total || 1;
  const cached = layerCount.memory + layerCount.browser + layerCount.idb;
  const staticServed = cached + layerCount.cdn;

  const pct = (n: number) => (n / denom) * 100;

  cachedSnapshot = {
    total,
    layerCount: { ...layerCount },
    layerBytes: { ...layerBytes },
    layerPct: {
      memory: pct(layerCount.memory),
      browser: pct(layerCount.browser),
      idb: pct(layerCount.idb),
      cdn: pct(layerCount.cdn),
      db: pct(layerCount.db),
    },
    cacheHitRatio: pct(staticServed),
    dbFallbackRatio: pct(layerCount.db),
    readsPerSession: layerCount.db,
    egressPerSession: layerBytes.db,
    dbBytes: layerBytes.db,
    savedBytes: staticServed * AVG_DB_PAYLOAD_BYTES,
    preventedReads: staticServed,
    staticFilesServed: staticServed,
    topPaths: Array.from(paths.values()).sort((a, b) => b.count - a.count).slice(0, 12),
    missReasons: Array.from(missReasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    fallbacks: fallbackEvents.slice(0, 25),
    recent: recent.slice(0, 40),
    prefetchIssued,
    prefetchUsed,
    sinceMs: Date.now() - startedAt,
  };
  return cachedSnapshot;
}


// Diagnostics hook: lets an operator (or an automated check) read the live
// in-tab telemetry from the console without opening a dashboard.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__P4NO_TRAFFIC__ = getTrafficSnapshot;
}
