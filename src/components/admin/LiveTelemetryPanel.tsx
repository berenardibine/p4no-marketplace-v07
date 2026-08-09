// Live delivery telemetry panel — shared by the Enterprise Traffic Dashboard
// and the Cache Monitor.
//
// Data source: Broadcast channel `p4no:traffic-monitor` fed by real delivery
// events from every live session. The panel is PASSIVE — it performs no
// database queries, has no polling timer, and re-renders only when a real
// telemetry event arrives.

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, AlertTriangle, Database, FlaskConical, Gauge, Radio } from 'lucide-react';
import { LAYERS, LAYER_META, useLiveTelemetry } from '@/hooks/useLiveTelemetry';
import { getContent } from '@/lib/cdnGuard';
import { getPublisherStats } from '@/lib/telemetryBus';

function fmtBytes(n: number) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

/** A PostgREST row payload we avoided fetching, on average. */
const AVG_DB_PAYLOAD_BYTES = 1400;
const EGRESS_USD_PER_GB = 0.09;

function Metric({ label, value, source, hint }: { label: string; value: string; source: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">Source: {source}</div>
      </CardContent>
    </Card>
  );
}

export default function LiveTelemetryPanel() {
  const t = useLiveTelemetry();
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const hasTraffic = t.requests > 0;
  const staleMs = t.lastEventAt ? Date.now() - t.lastEventAt : null;
  const preventedReads = t.requests - t.dbFallbacks;
  const savedBytes = preventedReads * AVG_DB_PAYLOAD_BYTES;
  const savedUsd = (savedBytes / 1024 / 1024 / 1024) * EGRESS_USD_PER_GB;
  const hitRatio = hasTraffic ? (t.cacheHits / t.requests) * 100 : 0;
  const dbRatio = hasTraffic ? (t.dbFallbacks / t.requests) * 100 : 0;
  const pub = getPublisherStats();

  async function runTest() {
    setTesting(true);
    setTestMsg(null);
    const started = Date.now();
    try {
      // One controlled request through the REAL delivery pipeline. No fallback
      // is supplied, so it can never create a database read or a write.
      await getContent('categories');
      setTestMsg(`Test event sent through the delivery pipeline in ${Date.now() - started}ms — it appears in the inspector within one batch window (≤5s).`);
    } catch {
      setTestMsg('Test request failed — delivery layer unreachable.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Telemetry status */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Radio className={`h-4 w-4 ${t.status === 'live' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          <div className="text-sm font-medium">
            Telemetry status:{' '}
            {t.status === 'live' ? (
              hasTraffic ? <span className="text-emerald-600">● LIVE</span> : <span>○ LIVE — waiting for traffic</span>
            ) : t.status === 'connecting' ? (
              <span>○ Connecting…</span>
            ) : (
              <span className="text-destructive">○ DISCONNECTED</span>
            )}
          </div>
          <Badge variant="outline" className="text-[10px]">Sessions reporting: {t.sessions}</Badge>
          <Badge variant="outline" className="text-[10px]">Events received: {t.eventsReceived}</Badge>
          <Badge variant="outline" className="text-[10px]">Events dropped: {pub.dropped}</Badge>
          <Badge variant="outline" className="text-[10px]">
            Last event: {t.lastEventAt ? new Date(t.lastEventAt).toLocaleTimeString() : '—'}
          </Badge>
          <Badge variant="outline" className="text-[10px]">Overhead: 1 broadcast msg / 5s / active session</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
              <FlaskConical className="mr-1 h-3.5 w-3.5" />
              {testing ? 'Testing…' : 'Test delivery telemetry'}
            </Button>
            <Button size="sm" variant="ghost" onClick={t.reset}>Clear session view</Button>
          </div>
        </CardContent>
      </Card>

      {testMsg && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">{testMsg}</div>
      )}

      {t.status === 'live' && !hasTraffic && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
          <div>
            <strong>No traffic detected yet.</strong> The channel is connected and no delivery events have arrived —
            these are not zero measurements. Browse the public site (or press “Test delivery telemetry”) and events
            appear here within one 5-second batch window.
          </div>
        </div>
      )}
      {staleMs !== null && staleMs > 5 * 60_000 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
          WARNING: no telemetry events received for {Math.round(staleMs / 60000)} minutes. Check delivery instrumentation.
        </div>
      )}

      {/* Executive overview */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Requests (live)" value={hasTraffic ? t.requests.toLocaleString() : '—'} source="Delivery telemetry" hint={hasTraffic ? undefined : 'No traffic detected'} />
        <Metric label="Cache hit ratio" value={hasTraffic ? `${hitRatio.toFixed(1)}%` : '—'} source="Delivery telemetry" hint={`${t.cacheHits.toLocaleString()} hits`} />
        <Metric label="Database fallback ratio" value={hasTraffic ? `${dbRatio.toFixed(1)}%` : '—'} source="PostgREST telemetry" hint={`${t.dbFallbacks.toLocaleString()} reads`} />
        <Metric label="PostgREST egress" value={hasTraffic ? fmtBytes(t.postgrestBytes) : '—'} source="PostgREST telemetry" />
        <Metric label="DB reads prevented" value={hasTraffic ? preventedReads.toLocaleString() : '—'} source="Delivery telemetry" />
        <Metric label="Est. egress saved" value={hasTraffic ? fmtBytes(savedBytes) : '—'} source="Delivery telemetry (modelled)" />
        <Metric label="Est. cost saved" value={hasTraffic ? `$${savedUsd.toFixed(4)}` : '—'} source="Delivery telemetry (modelled)" hint={`@ $${EGRESS_USD_PER_GB}/GB`} />
        <Metric label="Latency avg / p95" value={hasTraffic ? `${t.avgMs} / ${t.p95Ms} ms` : '—'} source="Delivery telemetry" />
      </div>

      {/* Cache hierarchy */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4" /> Cache hierarchy
            <span className="ml-auto text-[10px] font-normal uppercase text-muted-foreground">Source: delivery layer</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasTraffic ? (
            <div className="text-xs text-muted-foreground">No traffic detected — no layer has served a request yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Layer</TableHead><TableHead>Requests</TableHead><TableHead>Hits</TableHead>
                  <TableHead>Misses</TableHead><TableHead>Hit ratio</TableHead><TableHead>Bytes served</TableHead><TableHead>Avg latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {LAYERS.map((l) => {
                  const count = t.layerCount[l];
                  const isDb = l === 'db';
                  const hits = isDb ? 0 : count;
                  const misses = isDb ? count : 0;
                  return (
                    <TableRow key={l}>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="mr-2 text-[10px]">{LAYER_META[l].code}</Badge>
                        {LAYER_META[l].label}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{count.toLocaleString()}</TableCell>
                      <TableCell className="text-xs tabular-nums">{hits.toLocaleString()}</TableCell>
                      <TableCell className="text-xs tabular-nums">{misses.toLocaleString()}</TableCell>
                      <TableCell className="w-40">
                        <Progress value={t.requests ? (count / t.requests) * 100 : 0} className="h-1.5" />
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{fmtBytes(t.layerBytes[l])}</TableCell>
                      <TableCell className="text-xs tabular-nums">{count ? Math.round(t.layerMs[l] / count) : 0}ms</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Endpoints + miss reasons */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top endpoints</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {t.routes.length === 0 && <div className="text-muted-foreground">No traffic detected.</div>}
            {t.routes.map((r) => (
              <div key={r.route} className="flex justify-between border-b py-1">
                <span className="truncate font-mono">{r.route}</span>
                <span className="tabular-nums text-muted-foreground">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Cache miss reasons</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {t.missReasons.length === 0 && <div className="text-muted-foreground">No misses recorded.</div>}
            {t.missReasons.map((m) => (
              <div key={m.reason} className="flex justify-between border-b py-1">
                <span className="truncate">{m.reason}</span>
                <span className="tabular-nums text-muted-foreground">{m.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Live request inspector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> Live request inspector
            <span className="ml-auto text-[10px] font-normal uppercase text-muted-foreground">Source: delivery telemetry</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[420px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead><TableHead>Request</TableHead><TableHead>Route</TableHead>
                <TableHead>Resource</TableHead><TableHead>Layer</TableHead><TableHead>Status</TableHead>
                <TableHead>Latency</TableHead><TableHead>DB</TableHead><TableHead>PostgREST</TableHead>
                <TableHead>Bytes</TableHead><TableHead>Cache</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.samples.map((s) => (
                <TableRow key={s.request_id + s.at}>
                  <TableCell className="whitespace-nowrap text-[11px]">{new Date(s.at).toLocaleTimeString()}</TableCell>
                  <TableCell className="font-mono text-[11px]">{s.request_id}</TableCell>
                  <TableCell className="max-w-[160px] truncate font-mono text-[11px]">{s.route}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-[11px]">{s.resource_type}</TableCell>
                  <TableCell className="text-[11px]">
                    <Badge variant="outline" className="text-[10px]">{LAYER_META[s.layer].code} {LAYER_META[s.layer].label}</Badge>
                  </TableCell>
                  <TableCell className="text-[11px]">{s.status}</TableCell>
                  <TableCell className="text-[11px]">{s.latency_ms}ms</TableCell>
                  <TableCell className="text-[11px]">{s.database_used ? 'YES' : 'NO'}</TableCell>
                  <TableCell className="text-[11px]">{s.postgrest_used ? 'YES' : 'NO'}</TableCell>
                  <TableCell className="text-[11px]">{fmtBytes(s.bytes)}</TableCell>
                  <TableCell className={`text-[11px] ${s.hit ? 'text-emerald-600' : 'text-destructive'}`}>{s.hit ? 'HIT' : 'MISS'}</TableCell>
                </TableRow>
              ))}
              {t.samples.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-xs text-muted-foreground">No traffic detected — waiting for real delivery events.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Fallback events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> Recent database fallback events
            <span className="ml-auto text-[10px] font-normal uppercase text-muted-foreground">Source: PostgREST telemetry</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          {t.fallbacks.length === 0 && <div className="text-muted-foreground">No database fallbacks recorded.</div>}
          {t.fallbacks.map((f) => (
            <div key={f.request_id + f.at} className="flex justify-between gap-2 border-b py-1">
              <span className="truncate font-mono">{f.resource_type} · {f.route}</span>
              <span className="text-muted-foreground">{f.miss_reason ?? '—'} · {f.latency_ms}ms · {fmtBytes(f.bytes)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
