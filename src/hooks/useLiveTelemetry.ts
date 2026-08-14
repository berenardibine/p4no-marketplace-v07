// Live fleet telemetry — passive subscriber over the Broadcast channel.
// Zero PostgREST reads: state is built purely from broadcast messages emitted
// by real delivery events across all live sessions (including this tab).
//
// Everything is accumulated PER SOURCE (public / admin / system) so the Cache
// Monitor can research real customer traffic without admin or background
// activity ever polluting the numbers.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MONITOR_SOURCES,
  accumulate,
  emptyAgg,
  emptySources,
  subscribeMonitor,
  type DeliverySample,
  type MonitorLayer,
  type MonitorSource,
  type SourceAgg,
  type TrafficSnapshotMessage,
} from '@/lib/telemetryBus';
import { clearHistory, readHistory } from '@/lib/telemetryHistory';

export const SOURCES: MonitorSource[] = MONITOR_SOURCES;
export type SourceFilter = MonitorSource | 'all';

export const LAYERS: MonitorLayer[] = ['memory', 'browser', 'idb', 'cdn', 'db'];

export const LAYER_META: Record<MonitorLayer, { code: string; label: string; source: string }> = {
  memory: { code: 'L1', label: 'Browser memory', source: 'Client delivery layer' },
  browser: { code: 'L2', label: 'Browser HTTP cache', source: 'Client delivery layer' },
  idb: { code: 'L3', label: 'IndexedDB', source: 'Client delivery layer' },
  cdn: { code: 'L4', label: 'Vercel / CDN', source: 'Delivery layer' },
  db: { code: 'L5', label: 'Database (PostgREST)', source: 'PostgREST telemetry' },
};

const emptyLayers = (): Record<MonitorLayer, number> => ({ memory: 0, browser: 0, idb: 0, cdn: 0, db: 0 });

/** A rendered view of one source (or of all sources combined). */
export interface TelemetryView {
  requests: number;
  cacheHits: number;
  dbFallbacks: number;
  postgrestBytes: number;
  totalBytes: number;
  layerCount: Record<MonitorLayer, number>;
  layerBytes: Record<MonitorLayer, number>;
  layerMs: Record<MonitorLayer, number>;
  routes: { route: string; count: number }[];
  resources: { resource: string; count: number }[];
  missReasons: { reason: string; count: number }[];
  samples: DeliverySample[];
  fallbacks: DeliverySample[];
  avgMs: number;
  p95Ms: number;
  lastAt: number | null;
  cacheHitRatio: number;
  dbRatio: number;
  preventedReads: number;
  /** Non-delivery traffic, never mixed into the cache-hit ratio. */
  writes: number;
  writeBytes: number;
  edgeCalls: number;
  edgeBytes: number;
  storageCalls: number;
  storageBytes: number;
  rpcCalls: number;
  errors: number;
  writeEndpoints: { endpoint: string; count: number }[];
  edgeEndpoints: { endpoint: string; count: number }[];
  topPathsByBytes: { path: string; bytes: number }[];
}

export interface LiveTelemetryState {
  status: 'connecting' | 'live' | 'error';
  /** Per-source raw aggregates (accumulated across all reporting sessions). */
  bySource: Record<MonitorSource, SourceAgg>;
  samples: DeliverySample[];
  duplicates: { key: string; count: number; source: MonitorSource }[];
  sessions: number;
  eventsReceived: number;
  lastEventAt: number | null;
  lastPublicAt: number | null;
}

const emptyView = (): TelemetryView => ({
  requests: 0,
  cacheHits: 0,
  dbFallbacks: 0,
  postgrestBytes: 0,
  totalBytes: 0,
  layerCount: emptyLayers(),
  layerBytes: emptyLayers(),
  layerMs: emptyLayers(),
  routes: [],
  resources: [],
  missReasons: [],
  samples: [],
  fallbacks: [],
  avgMs: 0,
  p95Ms: 0,
  lastAt: null,
  cacheHitRatio: 0,
  dbRatio: 0,
  preventedReads: 0,
  writes: 0,
  writeBytes: 0,
  edgeCalls: 0,
  edgeBytes: 0,
  storageCalls: 0,
  storageBytes: 0,
  rpcCalls: 0,
  errors: 0,
  writeEndpoints: [],
  edgeEndpoints: [],
  topPathsByBytes: [],
});

/**
 * Seed the monitor from the rolling history of REAL observed samples so that
 * traffic which happened before the dashboard opened is visible. This reads
 * localStorage only — zero network, zero database.
 */
function seedFromHistory(): { bySource: Record<MonitorSource, SourceAgg>; samples: DeliverySample[] } {
  const bySource = emptySources();
  let samples: DeliverySample[] = [];
  try {
    const rows = readHistory();
    for (const r of rows) accumulate(bySource[r.source] ?? bySource.public, r);
    samples = rows.slice(-200).reverse();
  } catch { /* history is best-effort */ }
  return { bySource, samples };
}

const initial = (): LiveTelemetryState => ({
  status: 'connecting',
  ...seedFromHistory(),
  duplicates: [],
  sessions: 0,
  eventsReceived: 0,
  lastEventAt: null,
  lastPublicAt: null,
});

function mergeAgg(target: SourceAgg, add: SourceAgg): SourceAgg {
  const out: SourceAgg = {
    requests: target.requests + add.requests,
    bytes: target.bytes + add.bytes,
    db: target.db + add.db,
    db_bytes: target.db_bytes + add.db_bytes,
    hits: target.hits + add.hits,
    layer_count: { ...target.layer_count },
    layer_bytes: { ...target.layer_bytes },
    layer_ms: { ...target.layer_ms },
    latencies: [...target.latencies, ...(add.latencies ?? [])].slice(-5000),
    routes: { ...target.routes },
    miss_reasons: { ...target.miss_reasons },
    resources: { ...target.resources },
    last_at: Math.max(target.last_at, add.last_at || 0),
    writes: target.writes + (add.writes ?? 0),
    write_bytes: target.write_bytes + (add.write_bytes ?? 0),
    edge: target.edge + (add.edge ?? 0),
    edge_bytes: target.edge_bytes + (add.edge_bytes ?? 0),
    storage: target.storage + (add.storage ?? 0),
    storage_bytes: target.storage_bytes + (add.storage_bytes ?? 0),
    rpc: target.rpc + (add.rpc ?? 0),
    errors: target.errors + (add.errors ?? 0),
    write_endpoints: { ...target.write_endpoints },
    edge_endpoints: { ...target.edge_endpoints },
    path_bytes: { ...target.path_bytes },
  };
  for (const [k, v] of Object.entries(add.write_endpoints ?? {})) out.write_endpoints[k] = (out.write_endpoints[k] ?? 0) + (v as number);
  for (const [k, v] of Object.entries(add.edge_endpoints ?? {})) out.edge_endpoints[k] = (out.edge_endpoints[k] ?? 0) + (v as number);
  for (const [k, v] of Object.entries(add.path_bytes ?? {})) out.path_bytes[k] = (out.path_bytes[k] ?? 0) + (v as number);
  for (const l of LAYERS) {
    out.layer_count[l] += add.layer_count?.[l] ?? 0;
    out.layer_bytes[l] += add.layer_bytes?.[l] ?? 0;
    out.layer_ms[l] += add.layer_ms?.[l] ?? 0;
  }
  for (const [k, v] of Object.entries(add.routes ?? {})) out.routes[k] = (out.routes[k] ?? 0) + (v as number);
  for (const [k, v] of Object.entries(add.miss_reasons ?? {})) out.miss_reasons[k] = (out.miss_reasons[k] ?? 0) + (v as number);
  for (const [k, v] of Object.entries(add.resources ?? {})) out.resources[k] = (out.resources[k] ?? 0) + (v as number);
  return out;
}

function combine(aggs: SourceAgg[]): SourceAgg {
  return aggs.reduce((acc, a) => mergeAgg(acc, a), emptyAgg());
}

function toView(agg: SourceAgg, samples: DeliverySample[]): TelemetryView {
  const sorted = [...agg.latencies].sort((a, b) => a - b);
  const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
  const rank = (o: Record<string, number>, key: string, limit: number) =>
    Object.entries(o)
      .map(([k, count]) => ({ [key]: k, count }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, limit) as never[];
  return {
    requests: agg.requests,
    cacheHits: agg.hits,
    dbFallbacks: agg.db,
    postgrestBytes: agg.db_bytes,
    totalBytes: agg.bytes,
    layerCount: agg.layer_count,
    layerBytes: agg.layer_bytes,
    layerMs: agg.layer_ms,
    routes: rank(agg.routes, 'route', 12),
    resources: rank(agg.resources, 'resource', 12),
    missReasons: rank(agg.miss_reasons, 'reason', 12),
    samples,
    fallbacks: samples.filter((s) => s.database_used).slice(0, 25),
    avgMs: Math.round(avg),
    p95Ms: Math.round(p95),
    lastAt: agg.last_at || null,
    cacheHitRatio: agg.requests ? (agg.hits / agg.requests) * 100 : 0,
    dbRatio: agg.requests ? (agg.db / agg.requests) * 100 : 0,
    preventedReads: Math.max(0, agg.requests - agg.db),
    writes: agg.writes ?? 0,
    writeBytes: agg.write_bytes ?? 0,
    edgeCalls: agg.edge ?? 0,
    edgeBytes: agg.edge_bytes ?? 0,
    storageCalls: agg.storage ?? 0,
    storageBytes: agg.storage_bytes ?? 0,
    rpcCalls: agg.rpc ?? 0,
    errors: agg.errors ?? 0,
    writeEndpoints: rank(agg.write_endpoints ?? {}, 'endpoint', 10),
    edgeEndpoints: rank(agg.edge_endpoints ?? {}, 'endpoint', 10),
    topPathsByBytes: Object.entries(agg.path_bytes ?? {})
      .map(([path, bytes]) => ({ path, bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 12),
  };
}

export function useLiveTelemetry(filter: SourceFilter = 'public') {
  const [state, setState] = useState<LiveTelemetryState>(initial);
  const sessions = useRef(new Set<string>());
  // Repetition detector: counts identical route+source pairs seen in the feed.
  const repeats = useRef(new Map<string, { count: number; source: MonitorSource }>());

  const reset = useCallback(() => {
    repeats.current.clear();
    sessions.current.clear();
    clearHistory();
    setState((s) => ({ ...initial(), status: s.status }));
  }, []);

  useEffect(() => {
    const onMessage = (msg: TrafficSnapshotMessage) => {
      sessions.current.add(msg.session);
      for (const s of msg.samples ?? []) {
        const key = `${s.source}:${s.route}`;
        const cur = repeats.current.get(key);
        if (cur) cur.count += 1;
        else repeats.current.set(key, { count: 1, source: s.source });
      }

      setState((prev) => {
        const bySource = emptySources();
        for (const src of SOURCES) {
          bySource[src] = mergeAgg(prev.bySource[src], msg.by_source?.[src] ?? emptySources()[src]);
        }
        const newSamples = [...(msg.samples ?? [])].reverse();
        const publicAt = msg.by_source?.public?.last_at || 0;
        return {
          ...prev,
          bySource,
          samples: [...newSamples, ...prev.samples].slice(0, 200),
          duplicates: [...repeats.current.entries()]
            .filter(([, v]) => v.count >= 5 && v.source !== 'public')
            .map(([key, v]) => ({ key, count: v.count, source: v.source }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
          sessions: sessions.current.size,
          eventsReceived: prev.eventsReceived + 1,
          lastEventAt: Date.now(),
          lastPublicAt: publicAt > (prev.lastPublicAt ?? 0) ? publicAt : prev.lastPublicAt,
        };
      });
    };

    const off = subscribeMonitor(onMessage, (status) =>
      setState((prev) => (prev.status === status ? prev : { ...prev, status })),
    );
    return off;
  }, []);

  const views = useMemo(() => {
    const perSource = {
      public: toView(state.bySource.public, state.samples.filter((s) => s.source === 'public')),
      admin: toView(state.bySource.admin, state.samples.filter((s) => s.source === 'admin')),
      system: toView(state.bySource.system, state.samples.filter((s) => s.source === 'system')),
    } as Record<MonitorSource, TelemetryView>;
    const all = toView(combine(SOURCES.map((s) => state.bySource[s])), state.samples);
    return { ...perSource, all };
  }, [state.bySource, state.samples]);

  const view: TelemetryView = views[filter] ?? views.all ?? emptyView();

  return { ...state, view, views, reset };
}
