// Live fleet telemetry — passive subscriber over the Broadcast channel.
// Zero PostgREST reads: state is built purely from broadcast messages emitted
// by real delivery events across all live sessions (including this tab).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  subscribeMonitor,
  type DeliverySample,
  type MonitorLayer,
  type TrafficSnapshotMessage,
} from '@/lib/telemetryBus';

export const LAYERS: MonitorLayer[] = ['memory', 'browser', 'idb', 'cdn', 'db'];

export const LAYER_META: Record<MonitorLayer, { code: string; label: string; source: string }> = {
  memory: { code: 'L1', label: 'Browser memory', source: 'Client delivery layer' },
  browser: { code: 'L2', label: 'Browser HTTP cache', source: 'Client delivery layer' },
  idb: { code: 'L3', label: 'IndexedDB', source: 'Client delivery layer' },
  cdn: { code: 'L4', label: 'Vercel / CDN', source: 'Delivery layer' },
  db: { code: 'L5', label: 'Database (PostgREST)', source: 'PostgREST telemetry' },
};

const empty = (): Record<MonitorLayer, number> => ({ memory: 0, browser: 0, idb: 0, cdn: 0, db: 0 });

export interface LiveTelemetryState {
  status: 'connecting' | 'live' | 'error';
  requests: number;
  cacheHits: number;
  dbFallbacks: number;
  postgrestBytes: number;
  totalBytes: number;
  layerCount: Record<MonitorLayer, number>;
  layerBytes: Record<MonitorLayer, number>;
  layerMs: Record<MonitorLayer, number>;
  routes: { route: string; count: number }[];
  missReasons: { reason: string; count: number }[];
  samples: DeliverySample[];
  fallbacks: DeliverySample[];
  sessions: number;
  eventsReceived: number;
  lastEventAt: number | null;
  avgMs: number;
  p95Ms: number;
}

const initial = (): LiveTelemetryState => ({
  status: 'connecting',
  requests: 0,
  cacheHits: 0,
  dbFallbacks: 0,
  postgrestBytes: 0,
  totalBytes: 0,
  layerCount: empty(),
  layerBytes: empty(),
  layerMs: empty(),
  routes: [],
  missReasons: [],
  samples: [],
  fallbacks: [],
  sessions: 0,
  eventsReceived: 0,
  lastEventAt: null,
  avgMs: 0,
  p95Ms: 0,
});

export function useLiveTelemetry() {
  const [state, setState] = useState<LiveTelemetryState>(initial);
  const latencies = useRef<number[]>([]);
  const routeMap = useRef(new Map<string, number>());
  const missMap = useRef(new Map<string, number>());
  const sessions = useRef(new Set<string>());

  const reset = useCallback(() => {
    latencies.current = [];
    routeMap.current.clear();
    missMap.current.clear();
    sessions.current.clear();
    setState((s) => ({ ...initial(), status: s.status }));
  }, []);

  useEffect(() => {
    const onMessage = (msg: TrafficSnapshotMessage) => {
      sessions.current.add(msg.session);
      for (const [r, c] of Object.entries(msg.routes ?? {})) {
        routeMap.current.set(r, (routeMap.current.get(r) ?? 0) + c);
      }
      for (const [r, c] of Object.entries(msg.miss_reasons ?? {})) {
        missMap.current.set(r, (missMap.current.get(r) ?? 0) + c);
      }
      latencies.current.push(...(msg.latencies ?? []));
      if (latencies.current.length > 5000) latencies.current = latencies.current.slice(-5000);

      const sorted = [...latencies.current].sort((a, b) => a - b);
      const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
      const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;

      setState((prev) => {
        const layerCount = { ...prev.layerCount };
        const layerBytes = { ...prev.layerBytes };
        const layerMs = { ...prev.layerMs };
        for (const l of LAYERS) {
          layerCount[l] += msg.layer_count?.[l] ?? 0;
          layerBytes[l] += msg.layer_bytes?.[l] ?? 0;
          layerMs[l] += msg.layer_ms?.[l] ?? 0;
        }
        const newSamples = [...(msg.samples ?? [])].reverse();
        return {
          ...prev,
          requests: prev.requests + msg.requests,
          cacheHits: prev.cacheHits + msg.cache_hits,
          dbFallbacks: prev.dbFallbacks + msg.database_fallbacks,
          postgrestBytes: prev.postgrestBytes + msg.postgrest_bytes,
          totalBytes: prev.totalBytes + msg.total_bytes,
          layerCount,
          layerBytes,
          layerMs,
          routes: [...routeMap.current.entries()]
            .map(([route, count]) => ({ route, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 12),
          missReasons: [...missMap.current.entries()]
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
          samples: [...newSamples, ...prev.samples].slice(0, 60),
          fallbacks: [...newSamples.filter((s) => s.database_used), ...prev.fallbacks].slice(0, 25),
          sessions: sessions.current.size,
          eventsReceived: prev.eventsReceived + 1,
          lastEventAt: Date.now(),
          avgMs: Math.round(avg),
          p95Ms: Math.round(p95),
        };
      });
    };

    const off = subscribeMonitor(onMessage, (status) =>
      setState((prev) => (prev.status === status ? prev : { ...prev, status })),
    );
    return off;
  }, []);

  return { ...state, reset };
}
