// P4NO Live Telemetry Bus (Broadcast)
// -----------------------------------
// WHY: delivery telemetry is per-tab and in-memory. A visitor served entirely
// from browser cache / IndexedDB / CDN never touches Supabase, so neither the
// database nor the admin tab can ever "see" that traffic. This bus carries
// AGGREGATED delivery metrics from every live session to the admin dashboard
// over a single Supabase Realtime **Broadcast** channel.
//
// Cost profile (deliberate):
//   • ZERO PostgREST reads, ZERO database writes, ZERO rows created.
//   • No setInterval anywhere. Flushes are scheduled by real traffic only
//     (one setTimeout per batch window), and the socket disconnects after
//     an idle period.
//   • 1,000,000 requests → aggregated counters, ~1 tiny message / 5s / session.
//
// EVERYTHING is partitioned by source (PUBLIC / ADMIN / SYSTEM) at the point of
// measurement, so the monitor can research real customer traffic without admin
// or background activity ever polluting it.
//
// Payload contains only non-sensitive aggregates + route shapes (never IDs of
// users, never tokens, never response bodies).

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const TELEMETRY_CHANNEL = 'p4no:traffic-monitor';
const EVENT = 'traffic_snapshot';

/** Batch window: events are aggregated locally, then one message is sent. */
const FLUSH_MS = 5_000;
/** The very first window of a session is short so short visits still report. */
const FIRST_FLUSH_MS = 1_200;
/** Socket closes after this long with no delivery traffic. */
const IDLE_DISCONNECT_MS = 60_000;
/** Max sampled request rows carried per message (inspector view). */
const MAX_SAMPLES = 24;

export type MonitorLayer = 'memory' | 'browser' | 'idb' | 'cdn' | 'db';

/** Who caused the request. PUBLIC / ADMIN / SYSTEM are never mixed. */
export type MonitorSource = 'public' | 'admin' | 'system';

export const MONITOR_SOURCES: MonitorSource[] = ['public', 'admin', 'system'];

/**
 * Request classes. Delivery reads and database reads answer "how was content
 * delivered"; writes / edge / storage / rpc are REAL traffic too, but they are
 * never folded into the cache-hit ratio.
 */
export type RequestClass =
  | 'delivery_read'
  | 'db_read'
  | 'db_write'
  | 'edge_function'
  | 'storage'
  | 'rpc';

export const isDeliveryClass = (k?: RequestClass) => !k || k === 'delivery_read' || k === 'db_read';

/** Full per-source aggregate — the monitor can render any view from these. */
export interface SourceAgg {
  requests: number;
  bytes: number;
  db: number;
  db_bytes: number;
  hits: number;
  layer_count: Record<MonitorLayer, number>;
  layer_bytes: Record<MonitorLayer, number>;
  layer_ms: Record<MonitorLayer, number>;
  latencies: number[];
  routes: Record<string, number>;
  miss_reasons: Record<string, number>;
  resources: Record<string, number>;
  last_at: number;
  /** Non-delivery traffic, accounted separately (never a cache hit/miss). */
  writes: number;
  write_bytes: number;
  edge: number;
  edge_bytes: number;
  storage: number;
  storage_bytes: number;
  rpc: number;
  errors: number;
  write_endpoints: Record<string, number>;
  edge_endpoints: Record<string, number>;
  path_bytes: Record<string, number>;
}

export interface DeliverySample {
  request_id: string;
  at: number;
  route: string;
  path: string;
  resource_type: string;
  layer: MonitorLayer;
  status: number;
  latency_ms: number;
  bytes: number;
  database_used: boolean;
  postgrest_used: boolean;
  hit: boolean;
  miss_reason?: string;
  source: MonitorSource;
  /** Defaults to a delivery read when absent (legacy messages). */
  kind?: RequestClass;
  /** HTTP verb, for write forensics. */
  method?: string;
}


export interface TrafficSnapshotMessage {
  type: 'traffic_snapshot';
  session: string;
  at: number;
  window_ms: number;
  /** Total across all sources (kept for quick totals). */
  requests: number;
  by_source: Record<MonitorSource, SourceAgg>;
  samples: DeliverySample[];
}

// -------------------- session identity --------------------

function makeId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

export const TELEMETRY_SESSION = makeId();

// -------------------- publisher --------------------

const emptyLayers = (): Record<MonitorLayer, number> => ({
  memory: 0,
  browser: 0,
  idb: 0,
  cdn: 0,
  db: 0,
});

export const emptyAgg = (): SourceAgg => ({
  requests: 0,
  bytes: 0,
  db: 0,
  db_bytes: 0,
  hits: 0,
  layer_count: emptyLayers(),
  layer_bytes: emptyLayers(),
  layer_ms: emptyLayers(),
  latencies: [],
  routes: {},
  miss_reasons: {},
  resources: {},
  last_at: 0,
});

export const emptySources = (): Record<MonitorSource, SourceAgg> => ({
  public: emptyAgg(),
  admin: emptyAgg(),
  system: emptyAgg(),
});

let pending = {
  requests: 0,
  by_source: emptySources(),
  samples: [] as DeliverySample[],
  windowStart: Date.now(),
};

function resetPending() {
  pending = {
    requests: 0,
    by_source: emptySources(),
    samples: [],
    windowStart: Date.now(),
  };
}

let pubChannel: RealtimeChannel | null = null;
let pubReady = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let sent = 0;
let dropped = 0;
let flushes = 0;

/** Publishing is opt-outable (e.g. for tests) but ON by default in browsers. */
function publishingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { __P4NO_TELEMETRY_PUBLISH__?: boolean };
  return w.__P4NO_TELEMETRY_PUBLISH__ !== false;
}

const inbound = new Set<MonitorHandler>();
const statusWatchers = new Set<MonitorStatusHandler>();

function ensureChannel(): RealtimeChannel {
  if (pubChannel) return pubChannel;
  const ch = supabase.channel(TELEMETRY_CHANNEL, {
    config: { broadcast: { self: true, ack: false } },
  });
  pubChannel = ch;
  ch.on('broadcast', { event: EVENT }, ({ payload }) => {
    inbound.forEach((fn) => {
      try { fn(payload as TrafficSnapshotMessage); } catch { /* ignore */ }
    });
  }).subscribe((status) => {
    pubReady = status === 'SUBSCRIBED';
    if (pubReady) drainOutbox();
    const mapped: 'connecting' | 'live' | 'error' =
      pubReady ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'error' : 'connecting';
    statusWatchers.forEach((fn) => {
      try { fn(mapped); } catch { /* ignore */ }
    });
  });
  return ch;
}

// A channel only accepts sends once it reaches SUBSCRIBED. The very first
// batch of a visitor session used to be emitted while the socket was still
// joining and was silently lost — which is why admin monitors saw nothing from
// real public sessions. Queue instead, and drain on SUBSCRIBED.
const outbox: TrafficSnapshotMessage[] = [];
const MAX_OUTBOX = 20;

function drainOutbox() {
  if (!pubChannel || !pubReady) return;
  while (outbox.length) {
    const msg = outbox.shift()!;
    try {
      void pubChannel.send({ type: 'broadcast', event: EVENT, payload: msg });
      sent += 1;
    } catch {
      dropped += 1;
    }
  }
}

function armIdleDisconnect() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    // A dashboard that is listening keeps the socket open; otherwise close it.
    if (inbound.size === 0 && pubChannel) {
      void supabase.removeChannel(pubChannel);
      pubChannel = null;
      pubReady = false;
    }
    idleTimer = null;
  }, IDLE_DISCONNECT_MS);
}

function trimLatencies(a: SourceAgg) {
  if (a.latencies.length > 200) a.latencies = a.latencies.slice(-200);
}

function flush() {
  flushTimer = null;
  if (pending.requests === 0) return;
  flushes += 1;

  for (const s of MONITOR_SOURCES) trimLatencies(pending.by_source[s]);

  const msg: TrafficSnapshotMessage = {
    type: 'traffic_snapshot',
    session: TELEMETRY_SESSION,
    at: Date.now(),
    window_ms: Date.now() - pending.windowStart,
    requests: pending.requests,
    by_source: pending.by_source,
    samples: pending.samples,
  };
  resetPending();

  outbox.push(msg);
  if (outbox.length > MAX_OUTBOX) {
    outbox.splice(0, outbox.length - MAX_OUTBOX);
    dropped += 1;
  }
  ensureChannel();
  drainOutbox();
  armIdleDisconnect();
}

/**
 * Keep the sample buffer bounded WITHOUT letting admin/system chatter crowd
 * out real public traffic (public rows are the research signal).
 */
function pushSample(s: DeliverySample) {
  if (pending.samples.length < MAX_SAMPLES) {
    pending.samples.push(s);
    return;
  }
  if (s.source !== 'public') return;
  const idx = pending.samples.findIndex((x) => x.source !== 'public');
  if (idx >= 0) pending.samples[idx] = s;
}

/** Record one real delivery event. Aggregated locally, never written to the DB. */
export function publishDelivery(s: DeliverySample): void {
  if (!publishingEnabled()) return;
  const a = pending.by_source[s.source] ?? pending.by_source.public;
  const bytes = Math.max(0, s.bytes || 0);
  const ms = Math.max(0, s.latency_ms || 0);

  pending.requests += 1;
  a.requests += 1;
  a.bytes += bytes;
  a.last_at = s.at || Date.now();
  a.layer_count[s.layer] += 1;
  a.layer_bytes[s.layer] += bytes;
  a.layer_ms[s.layer] += ms;
  a.latencies.push(ms);
  if (s.hit) a.hits += 1;
  if (s.database_used) {
    a.db += 1;
    a.db_bytes += bytes;
  }
  a.routes[s.route] = (a.routes[s.route] ?? 0) + 1;
  if (s.resource_type) a.resources[s.resource_type] = (a.resources[s.resource_type] ?? 0) + 1;
  a.miss_reasons[s.miss_reason ?? (s.hit ? 'cache_hit' : 'database_fallback')] =
    (a.miss_reasons[s.miss_reason ?? (s.hit ? 'cache_hit' : 'database_fallback')] ?? 0) + 1;

  pushSample(s);

  // No polling: one timer per batch window, created by real traffic only.
  if (!flushTimer) {
    // Warm the socket now so it is SUBSCRIBED by the time the window closes.
    try { ensureChannel(); } catch { /* ignore */ }
    flushTimer = setTimeout(flush, flushes === 0 ? FIRST_FLUSH_MS : FLUSH_MS);
  }
}

export function getPublisherStats() {
  return {
    session: TELEMETRY_SESSION,
    connected: pubReady,
    sent,
    dropped,
    queued: outbox.length,
    pending: pending.requests,
  };
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__P4NO_TELEMETRY_BUS__ = getPublisherStats;
  // Deliver the last partial batch when the tab goes away.
  const bail = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (pending.requests > 0) flush();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') bail();
  });
  window.addEventListener('pagehide', bail);
}

// -------------------- subscriber (admin dashboard) --------------------

export type MonitorHandler = (msg: TrafficSnapshotMessage) => void;
export type MonitorStatusHandler = (status: 'connecting' | 'live' | 'error') => void;

/**
 * Subscribe the admin dashboard to the live telemetry channel.
 * Passive: it never queries Postgres, it only listens for broadcast messages.
 */
export function subscribeMonitor(onMessage: MonitorHandler, onStatus?: MonitorStatusHandler): () => void {
  inbound.add(onMessage);
  if (onStatus) {
    statusWatchers.add(onStatus);
    onStatus(pubReady ? 'live' : 'connecting');
  }
  ensureChannel();
  return () => {
    inbound.delete(onMessage);
    if (onStatus) statusWatchers.delete(onStatus);
    if (inbound.size === 0 && pending.requests === 0 && pubChannel) {
      void supabase.removeChannel(pubChannel);
      pubChannel = null;
      pubReady = false;
    }
  };
}
