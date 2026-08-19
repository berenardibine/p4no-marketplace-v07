// Live delivery telemetry panel — the canonical live data view of the
// Cache Monitor.
//
// Data source: Broadcast channel `p4no:traffic-monitor` fed by real delivery
// events from every live session (public visitors included). The panel is
// PASSIVE — no database query, no polling timer; it re-renders only when a
// real telemetry event arrives.
//
// Everything is partitioned by source. The default view is PUBLIC because this
// dashboard exists to research real customer traffic; admin (including this
// page) and background/system activity can never inflate it.

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, AlertTriangle, Copy, Database, FlaskConical, Gauge, PieChart as PieIcon, Radio, Users } from 'lucide-react';
import { LAYERS, LAYER_META, SOURCES, useLiveTelemetry, type SourceFilter } from '@/hooks/useLiveTelemetry';
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

const LAYER_COLOR: Record<string, string> = {
  memory: 'hsl(var(--primary))',
  browser: 'hsl(var(--chart-2, 173 58% 39%))',
  idb: 'hsl(var(--chart-3, 197 37% 44%))',
  cdn: 'hsl(var(--chart-4, 43 74% 56%))',
  db: 'hsl(var(--destructive))',
};

const FILTERS: { key: SourceFilter; label: string }[] = [
  { key: 'public', label: 'PUBLIC' },
  { key: 'admin', label: 'ADMIN' },
  { key: 'system', label: 'SYSTEM' },
  { key: 'all', label: 'ALL' },
];

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
  const [filter, setFilter] = useState<SourceFilter>('public');
  const t = useLiveTelemetry(filter);
  const v = t.view;
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const hasTraffic = v.requests > 0;
  // "Telemetry unavailable" is only honest when the pipeline is degraded; a
  // connected channel with no events is a MEASURED zero and says so instead.
  const unavailable = t.status !== 'live';
  const na = (value: string) => (unavailable ? 'Telemetry unavailable' : hasTraffic ? value : 'Waiting for traffic');
  const staleMs = t.lastEventAt ? Date.now() - t.lastEventAt : null;
  const savedBytes = v.preventedReads * AVG_DB_PAYLOAD_BYTES;
  const savedUsd = (savedBytes / 1024 / 1024 / 1024) * EGRESS_USD_PER_GB;
  const pub = getPublisherStats();

  const pieData = LAYERS.map((l) => ({ name: LAYER_META[l].label, key: l, value: v.layerCount[l] })).filter((d) => d.value > 0);

  async function runTest() {
    setTesting(true);
    setTestMsg(null);
    const started = Date.now();
    try {
      // One controlled request through the REAL delivery pipeline. No fallback
      // is supplied, so it can never create a database read or a write.
      await getContent('categories');
      setTestMsg(`Test event sent through the delivery pipeline in ${Date.now() - started}ms — it is classified ADMIN (this page) and appears under the ADMIN filter within one batch window.`);
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
            LIVE TELEMETRY:{' '}
            {t.status === 'live' ? (
              t.views.public.requests > 0
                ? <span className="text-emerald-600">CONNECTED</span>
                : <span className="text-amber-600">WAITING FOR PUBLIC TRAFFIC</span>
            ) : t.status === 'connecting' ? (
              <span>CONNECTING…</span>
            ) : (
              <span className="text-destructive">DISCONNECTED</span>
            )}
          </div>
          <Badge variant="outline" className="text-[10px]">Sessions reporting: {t.sessions}</Badge>
          <Badge variant="outline" className="text-[10px]">Events received: {t.eventsReceived}</Badge>
          <Badge variant="outline" className="text-[10px]">Events dropped: {pub.dropped}</Badge>
          <Badge variant="outline" className="text-[10px]">
            Last public event: {t.lastPublicAt ? new Date(t.lastPublicAt).toLocaleTimeString() : '—'}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Last telemetry event: {t.lastEventAt ? new Date(t.lastEventAt).toLocaleTimeString() : '—'}
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

      {/* Source filter — PUBLIC is the default research view */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <span className="mr-1 text-xs text-muted-foreground">Traffic source:</span>
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'default' : 'outline'}
              onClick={() => setFilter(f.key)}
              className="h-7 text-[11px]"
            >
              {f.label}
              <span className="ml-1 tabular-nums opacity-70">
                {f.key === 'all' ? t.views.all.requests : t.views[f.key].requests}
              </span>
            </Button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">
            Every metric below is scoped to <strong className="uppercase">{filter}</strong> traffic only.
          </span>
        </CardContent>
      </Card>

      {testMsg && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">{testMsg}</div>
      )}

      {t.status === 'live' && !hasTraffic && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
          <div>
            <strong>No {filter} traffic measured yet.</strong> The channel is connected and no {filter} delivery events
            have arrived — this is not a zero measurement. Browse the public site in another tab/device and events
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
        <Metric label={`${filter.toUpperCase()} requests`} value={na(v.requests.toLocaleString())} source="Delivery telemetry" />
        <Metric label="Cache hit ratio" value={na(`${v.cacheHitRatio.toFixed(1)}%`)} source="Delivery telemetry" hint={`${v.cacheHits.toLocaleString()} cache/CDN hits`} />
        <Metric label="Database fallback ratio" value={na(`${v.dbRatio.toFixed(1)}%`)} source="PostgREST telemetry" hint={`${v.dbFallbacks.toLocaleString()} Supabase reads`} />
        <Metric label="PostgREST egress" value={na(fmtBytes(v.postgrestBytes))} source="PostgREST telemetry" />
        <Metric label="DB reads prevented" value={na(v.preventedReads.toLocaleString())} source="Delivery telemetry" hint="Served by cache/CDN instead of Supabase" />
        <Metric label="Est. egress saved" value={na(fmtBytes(savedBytes))} source="Delivery telemetry (modelled)" />
        <Metric label="Est. cost saved" value={na(`$${savedUsd.toFixed(4)}`)} source="Delivery telemetry (modelled)" hint={`@ $${EGRESS_USD_PER_GB}/GB`} />
        <Metric label="Latency avg / p95" value={na(`${v.avgMs} / ${v.p95Ms} ms`)} source="Delivery telemetry" />
      </div>

      {/* Non-delivery traffic — observed, never mixed into the hit ratio */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> {filter.toUpperCase()} writes &amp; non-delivery traffic
            <span className="ml-auto text-[10px] font-normal uppercase text-muted-foreground">
              Observed — excluded from cache-hit ratio
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="DB writes" value={v.writes.toLocaleString()} source="PostgREST telemetry" hint={`${fmtBytes(v.writeBytes)} observed`} />
            <Metric label="Edge Function calls" value={v.edgeCalls.toLocaleString()} source="/functions/v1 telemetry" hint={`${fmtBytes(v.edgeBytes)} observed`} />
            <Metric label="Storage requests" value={v.storageCalls.toLocaleString()} source="/storage/v1 telemetry" hint={`${fmtBytes(v.storageBytes)} observed`} />
            <Metric label="RPC calls / errors" value={`${v.rpcCalls.toLocaleString()} / ${v.errors.toLocaleString()}`} source="PostgREST telemetry" />
          </div>
          {(v.writeEndpoints.length > 0 || v.edgeEndpoints.length > 0) && (
            <div className="grid gap-3 lg:grid-cols-2">
              {[
                { title: 'Write endpoints', rows: v.writeEndpoints },
                { title: 'Edge Function endpoints', rows: v.edgeEndpoints },
              ].map((block) => (
                <div key={block.title}>
                  <div className="mb-1 text-xs font-medium">{block.title}</div>
                  {block.rows.length === 0 ? (
                    <div className="text-xs text-muted-foreground">None observed</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Endpoint</TableHead><TableHead className="w-24">Requests</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {block.rows.slice(0, 8).map((r) => (
                          <TableRow key={r.endpoint}>
                            <TableCell className="font-mono text-[11px]">{r.endpoint}</TableCell>
                            <TableCell className="text-xs tabular-nums">{r.count.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery distribution + cache hierarchy */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieIcon className="h-4 w-4" /> {filter.toUpperCase()} delivery distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {unavailable ? 'Telemetry unavailable' : `No ${filter} traffic measured yet`}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                    {pieData.map((d) => <Cell key={d.key} fill={LAYER_COLOR[d.key]} />)}
                  </Pie>
                  <Tooltip formatter={(val: number) => [`${val} requests (${((val / (v.requests || 1)) * 100).toFixed(1)}%)`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4" /> Cache hierarchy
              <span className="ml-auto text-[10px] font-normal uppercase text-muted-foreground">Source: delivery layer</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasTraffic ? (
              <div className="text-xs text-muted-foreground">
                {unavailable ? 'Telemetry unavailable' : `No ${filter} traffic measured yet`}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Layer</TableHead><TableHead>Requests</TableHead><TableHead>Share</TableHead>
                    <TableHead>Bytes</TableHead><TableHead>Avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {LAYERS.map((l) => {
                    const count = v.layerCount[l];
                    return (
                      <TableRow key={l}>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="mr-2 text-[10px]">{LAYER_META[l].code}</Badge>
                          {LAYER_META[l].label}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">{count.toLocaleString()}</TableCell>
                        <TableCell className="w-28">
                          <Progress value={v.requests ? (count / v.requests) * 100 : 0} className="h-1.5" />
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">{fmtBytes(v.layerBytes[l])}</TableCell>
                        <TableCell className="text-xs tabular-nums">{count ? Math.round(v.layerMs[l] / count) : 0}ms</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Endpoints + resources + miss reasons */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top routes</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {v.routes.length === 0 && <div className="text-muted-foreground">No {filter} traffic measured yet.</div>}
            {v.routes.map((r) => (
              <div key={r.route} className="flex justify-between border-b py-1">
                <span className="truncate font-mono">{r.route}</span>
                <span className="tabular-nums text-muted-foreground">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top resources</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {v.resources.length === 0 && <div className="text-muted-foreground">No {filter} traffic measured yet.</div>}
            {v.resources.map((r) => (
              <div key={r.resource} className="flex justify-between border-b py-1">
                <span className="truncate font-mono">{r.resource}</span>
                <span className="tabular-nums text-muted-foreground">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Cache miss reasons</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {v.missReasons.length === 0 && <div className="text-muted-foreground">No misses recorded.</div>}
            {v.missReasons.map((m) => (
              <div key={m.reason} className="flex justify-between border-b py-1">
                <span className="truncate">{m.reason}</span>
                <span className="tabular-nums text-muted-foreground">{m.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Source split — PUBLIC / ADMIN / SYSTEM are never mixed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Traffic &amp; egress by source
            <span className="ml-auto text-[10px] font-normal uppercase text-muted-foreground">Source: delivery telemetry</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {t.views.all.requests === 0 ? (
            <div className="text-xs text-muted-foreground">
              {t.status === 'live' ? 'No traffic measured yet.' : 'Telemetry unavailable — the monitor is not connected to the delivery channel.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead><TableHead>Requests</TableHead><TableHead>Share</TableHead>
                  <TableHead>Cache hits</TableHead><TableHead>DB reads</TableHead>
                  <TableHead>Total bytes</TableHead><TableHead>PostgREST egress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SOURCES.map((src) => {
                  const a = t.bySource[src];
                  const share = t.views.all.requests ? (a.requests / t.views.all.requests) * 100 : 0;
                  return (
                    <TableRow key={src}>
                      <TableCell className="text-[11px] font-medium uppercase">{src}</TableCell>
                      <TableCell className="text-[11px] tabular-nums">{a.requests.toLocaleString()}</TableCell>
                      <TableCell className="text-[11px] tabular-nums">{share.toFixed(1)}%</TableCell>
                      <TableCell className="text-[11px] tabular-nums">{a.hits.toLocaleString()}</TableCell>
                      <TableCell className={`text-[11px] tabular-nums ${a.db > 0 ? 'text-destructive' : ''}`}>{a.db.toLocaleString()}</TableCell>
                      <TableCell className="text-[11px] tabular-nums">{fmtBytes(a.bytes)}</TableCell>
                      <TableCell className="text-[11px] tabular-nums">{fmtBytes(a.db_bytes)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="pt-2 text-[11px] text-muted-foreground">
            Admin pages (including this monitor) are classified ADMIN and can never inflate the public cache-hit ratio.
            Generators, cron, warming and health jobs are classified SYSTEM.
          </p>
        </CardContent>
      </Card>

      {/* Duplicate / repetition detection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Copy className="h-4 w-4" /> Repeated request detection
            <span className="ml-auto text-[10px] font-normal uppercase text-muted-foreground">Admin &amp; system only</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          {t.duplicates.length === 0 && (
            <div className="text-muted-foreground">
              No repeated admin/system request patterns flagged. Public traffic is never flagged.
            </div>
          )}
          {t.duplicates.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-2 border-b py-1">
              <span className="truncate font-mono">{d.key}</span>
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">{d.source}</Badge>
                <Badge variant="destructive" className="text-[10px]">POSSIBLE DUPLICATE ×{d.count}</Badge>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Live request inspector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> Live request inspector — {filter.toUpperCase()}
            <span className="ml-auto text-[10px] font-normal uppercase text-muted-foreground">Source: delivery telemetry</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[420px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead><TableHead>Source</TableHead><TableHead>Path</TableHead><TableHead>Route</TableHead>
                <TableHead>Entity</TableHead><TableHead>Delivery layer</TableHead><TableHead>Cache</TableHead>
                <TableHead>Status</TableHead><TableHead>Latency</TableHead><TableHead>Bytes</TableHead><TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.samples.slice(0, 80).map((s) => (
                <TableRow key={s.request_id + s.at}>
                  <TableCell className="whitespace-nowrap text-[11px]">{new Date(s.at).toLocaleTimeString()}</TableCell>
                  <TableCell className="text-[11px]">
                    <Badge variant={s.source === 'public' ? 'default' : 'outline'} className="text-[10px] uppercase">{s.source}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate font-mono text-[11px]">{s.path}</TableCell>
                  <TableCell className="max-w-[160px] truncate font-mono text-[11px]">{s.route}</TableCell>
                  <TableCell className="max-w-[140px] truncate text-[11px]">{s.resource_type}</TableCell>
                  <TableCell className="text-[11px]">
                    <Badge variant="outline" className="text-[10px]">{LAYER_META[s.layer].code} {LAYER_META[s.layer].label}</Badge>
                  </TableCell>
                  <TableCell className={`text-[11px] ${s.hit ? 'text-emerald-600' : 'text-destructive'}`}>{s.hit ? 'HIT' : 'MISS'}</TableCell>
                  <TableCell className="text-[11px]">{s.status}</TableCell>
                  <TableCell className="text-[11px]">{s.latency_ms}ms</TableCell>
                  <TableCell className="text-[11px]">{fmtBytes(s.bytes)}</TableCell>
                  <TableCell className="max-w-[140px] truncate text-[11px] text-muted-foreground">{s.miss_reason ?? '—'}</TableCell>
                </TableRow>
              ))}
              {v.samples.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-xs text-muted-foreground">
                  {unavailable ? 'Telemetry unavailable.' : `No ${filter} traffic measured yet — waiting for real delivery events.`}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Fallback events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> Recent database fallback events — {filter.toUpperCase()}
            <span className="ml-auto text-[10px] font-normal uppercase text-muted-foreground">Source: PostgREST telemetry</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          {v.fallbacks.length === 0 && <div className="text-muted-foreground">No database fallbacks recorded.</div>}
          {v.fallbacks.map((f) => (
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
