import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Database, Gauge, HardDrive, RefreshCw, Rocket, Zap } from 'lucide-react';
import {
  LAYER_LABEL,
  getTrafficSnapshot,
  resetTraffic,
  subscribeTraffic,
  type TrafficLayer,
} from '@/lib/trafficTelemetry';
import { getPrefetchState } from '@/lib/prefetch';
import { supabase } from '@/integrations/supabase/client';

const LAYER_ORDER: TrafficLayer[] = ['memory', 'browser', 'idb', 'cdn', 'db'];

function fmtBytes(n: number) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function AdminTrafficDashboard() {
  const snap = useSyncExternalStore(subscribeTraffic, getTrafficSnapshot, getTrafficSnapshot);
  const [prefetch, setPrefetch] = useState(getPrefetchState());
  const [gen, setGen] = useState<any>(null);
  const [loadingGen, setLoadingGen] = useState(false);

  useEffect(() => {
    setPrefetch(getPrefetchState());
  }, [snap.prefetchIssued, snap.total]);

  // Generator/storage stats are an explicit, manual read — never polled.
  const loadGenerator = useCallback(async () => {
    setLoadingGen(true);
    try {
      const { data } = await supabase.functions.invoke('static-health', { body: {} });
      setGen(data ?? null);
    } catch {
      setGen(null);
    } finally {
      setLoadingGen(false);
    }
  }, []);

  const sessionMinutes = Math.max(1, Math.round(snap.sinceMs / 60000));

  const layerRows = useMemo(
    () =>
      LAYER_ORDER.map((l) => ({
        layer: l,
        label: LAYER_LABEL[l],
        count: snap.layerCount[l],
        pct: snap.layerPct[l],
        bytes: snap.layerBytes[l],
      })),
    [snap],
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Enterprise Traffic Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live delivery-layer accounting for this session ({sessionMinutes} min). No polling, no background reads.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => resetTraffic()}>
            Reset counters
          </Button>
          <Button size="sm" onClick={loadGenerator} disabled={loadingGen}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingGen ? 'animate-spin' : ''}`} />
            Load generator stats
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Cache hit ratio" value={`${snap.cacheHitRatio.toFixed(1)}%`} hint={`${snap.total} public reads`} icon={Gauge} />
        <Stat label="Database fallback" value={`${snap.dbFallbackRatio.toFixed(1)}%`} hint={`${snap.readsPerSession} reads`} icon={Database} />
        <Stat label="Egress this session" value={fmtBytes(snap.egressPerSession)} hint="PostgREST payload only" icon={Activity} />
        <Stat label="Estimated egress saved" value={fmtBytes(snap.savedBytes)} hint={`${snap.preventedReads} DB reads prevented`} icon={Zap} />
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cache hierarchy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {layerRows.map((r) => (
            <div key={r.layer} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className={r.layer === 'db' ? 'font-medium text-destructive' : ''}>{r.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {r.count} · {r.pct.toFixed(1)}% · {fmtBytes(r.bytes)}
                </span>
              </div>
              <Progress value={r.pct} className="h-2" />
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            Every request stops at the highest layer possible. Only the last row costs PostgREST egress.
          </p>
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Static files served" value={String(snap.staticFilesServed)} hint="memory + cache + CDN" icon={HardDrive} />
        <Stat
          label="Avg reads / user"
          value={(snap.readsPerSession).toFixed(2)}
          hint="DB reads per browsing session"
          icon={Database}
        />
        <Stat label="Prefetched payloads" value={String(prefetch.warmed)} hint={`${prefetch.queued} queued · ${prefetch.running} running`} icon={Rocket} />
        <Stat label="Fallback events" value={String(snap.fallbacks.length)} hint="static miss → database" icon={Activity} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top endpoints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snap.topPaths.length === 0 && <p className="text-sm text-muted-foreground">No traffic recorded yet.</p>}
            {snap.topPaths.map((p) => (
              <div key={p.path} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-mono text-xs">{p.path}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{p.count}</Badge>
                  {p.db > 0 && <Badge variant="destructive">{p.db} DB</Badge>}
                  <span className="text-xs text-muted-foreground">{fmtBytes(p.bytes)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cache miss reasons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snap.missReasons.length === 0 && <p className="text-sm text-muted-foreground">No misses recorded.</p>}
            {snap.missReasons.map((m) => (
              <div key={m.reason} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{m.reason}</span>
                <Badge variant="outline">{m.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Generation queue &amp; storage</CardTitle>
        </CardHeader>
        <CardContent>
          {!gen && (
            <p className="text-sm text-muted-foreground">
              Manual read — press “Load generator stats” to query the static engine.
            </p>
          )}
          {gen && (
            <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(gen, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent fallback events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {snap.fallbacks.length === 0 && (
            <p className="text-sm text-muted-foreground">No database fallbacks — all traffic served statically.</p>
          )}
          {snap.fallbacks.map((f, i) => (
            <div key={`${f.path}-${i}`} className="flex items-center justify-between text-xs">
              <span className="truncate font-mono">{f.path}</span>
              <span className="shrink-0 text-muted-foreground">
                {f.missReason} · {f.ms}ms · {fmtBytes(f.bytes)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
