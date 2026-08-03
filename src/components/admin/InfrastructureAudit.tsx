import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getGuardStats, subscribeGuardStats } from '@/lib/cdnGuard';
import { BACKGROUND_INVENTORY, ESSENTIAL_JOBS, type InvStatus } from '@/lib/backgroundInventory';
import { FEATURE_REGISTRY, getFeatureState, loadFeatureFlags, subscribeFeatureFlags } from '@/lib/featureFlags';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, Pause, Play, RefreshCw, Repeat, Timer } from 'lucide-react';

interface CronJob { jobid: number; jobname: string; schedule: string; active: boolean; command: string }
interface CronRun { jobid: number; runid: number; status: string; return_message: string | null; start_time: string; end_time: string | null }

const STATUS_TONE: Record<InvStatus, string> = {
  removed: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  'event-driven': 'bg-sky-500/15 text-sky-600 border-sky-500/30',
  cached: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
  gated: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  active: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
};

const Stat = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => (
  <div className="rounded-lg border p-3">
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className={`text-xl font-bold ${tone ?? ''}`}>{value}</div>
  </div>
);

const InfrastructureAudit = () => {
  const [stats, setStats] = useState(() => getGuardStats());
  const [flags, setFlags] = useState<Record<string, boolean>>(() => getFeatureState());
  const [cron, setCron] = useState<{ jobs: CronJob[]; runs: CronRun[] } | null>(null);
  const [loadingCron, setLoadingCron] = useState(false);
  const [live, setLive] = useState(true);
  const [tick, setTick] = useState(0);

  // Guard stats are pushed by the interceptor — no polling.
  useEffect(() => subscribeGuardStats(() => setStats(getGuardStats())), []);
  useEffect(() => subscribeFeatureFlags(() => setFlags(getFeatureState())), []);
  useEffect(() => { void loadFeatureFlags(true); }, []);

  // Live view only re-renders the local counters; it issues no requests.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => { setStats(getGuardStats()); setTick((t) => t + 1); }, 2000);
    return () => clearInterval(id);
  }, [live]);

  const loadCron = useCallback(async () => {
    setLoadingCron(true);
    try {
      const { data, error } = await (supabase as any).rpc('infra_audit_cron');
      if (error) throw error;
      setCron({ jobs: data?.jobs ?? [], runs: data?.runs ?? [] });
    } catch {
      setCron({ jobs: [], runs: [] });
    }
    setLoadingCron(false);
  }, []);

  useEffect(() => { void loadCron(); }, [loadCron]);

  const recent = stats.recent ?? [];

  // ---- Detectors (all computed locally from intercepted traffic) ----
  const duplicates = useMemo(() => {
    const window = Date.now() - 60_000;
    const map = new Map<string, number>();
    recent.filter((r: any) => r.at >= window).forEach((r: any) => map.set(r.path, (map.get(r.path) ?? 0) + 1));
    return Array.from(map.entries()).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [recent, tick]);

  const polling = stats.polling ?? [];
  const supabaseHits = recent.filter((r: any) => r.source === 'supabase').length;
  const dbReads = supabaseHits;
  const hiddenRequests = useMemo(
    () => polling.filter((p: any) => !BACKGROUND_INVENTORY.some((i) => p.path.includes(i.name))).length,
    [polling],
  );

  const activeJobs = (cron?.jobs ?? []).filter((j) => j.active);
  const nonEssentialActive = activeJobs.filter((j) => !ESSENTIAL_JOBS.some((e) => j.jobname.includes(e)));
  const disabledFeatures = FEATURE_REGISTRY.filter((f) => flags[f.key] === false);

  const savedReads = disabledFeatures.reduce((s, f) => s + f.readsPerVisit, 0);
  const savedKb = disabledFeatures.reduce((s, f) => s + f.egressKbPerVisit, 0);

  const warnings: string[] = [];
  if (nonEssentialActive.length) warnings.push(`${nonEssentialActive.length} non-essential cron job(s) still active: ${nonEssentialActive.map((j) => j.jobname).join(', ')}`);
  if (polling.length) warnings.push(`${polling.length} endpoint(s) exceeded the polling threshold in the last minute.`);
  if (duplicates.length) warnings.push(`${duplicates.length} duplicated request path(s) detected within 60s.`);
  if (stats.supabasePct > 20) warnings.push(`Supabase serves ${stats.supabasePct.toFixed(0)}% of reads — static coverage is too low.`);

  const cacheHit = 100 - (stats.supabasePct || 0);

  return (
    <div className="space-y-4">
      {/* Live controls */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant={live ? 'default' : 'outline'} onClick={() => setLive((v) => !v)}>
          {live ? <Pause className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
          {live ? 'Live' : 'Paused'}
        </Button>
        <Button size="sm" variant="outline" onClick={loadCron} disabled={loadingCron}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingCron ? 'animate-spin' : ''}`} />Reload cron
        </Button>
        <span className="text-[11px] text-muted-foreground">Live view reads intercepted traffic in memory — it issues no database requests.</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Background requests" value={recent.length} />
        <Stat label="PostgREST requests" value={supabaseHits} tone={supabaseHits ? 'text-amber-600' : 'text-emerald-600'} />
        <Stat label="DB reads (session)" value={dbReads} />
        <Stat label="Polling detected" value={polling.length} tone={polling.length ? 'text-rose-600' : 'text-emerald-600'} />
        <Stat label="Duplicates" value={duplicates.length} tone={duplicates.length ? 'text-amber-600' : 'text-emerald-600'} />
        <Stat label="Hidden requests" value={hiddenRequests} tone={hiddenRequests ? 'text-rose-600' : 'text-emerald-600'} />
        <Stat label="Cache hit" value={`${cacheHit.toFixed(1)}%`} tone="text-emerald-600" />
      </div>

      {/* Warnings */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Warnings & recommended fixes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {warnings.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />System idle — no background activity detected.</div>
          ) : warnings.map((w) => (
            <div key={w} className="flex items-start gap-2 text-sm"><AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" /><span>{w}</span></div>
          ))}
        </CardContent>
      </Card>

      {/* Cron */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Timer className="h-4 w-4" />Cron jobs ({activeJobs.length} active / {cron?.jobs.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Job</TableHead><TableHead>Schedule</TableHead><TableHead>State</TableHead><TableHead>Last run</TableHead></TableRow></TableHeader>
            <TableBody>
              {(cron?.jobs ?? []).map((j) => {
                const last = (cron?.runs ?? []).find((r) => r.jobid === j.jobid);
                return (
                  <TableRow key={j.jobid}>
                    <TableCell className="text-xs font-medium">{j.jobname}</TableCell>
                    <TableCell className="text-xs font-mono">{j.schedule}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={j.active ? 'bg-rose-500/15 text-rose-600 border-rose-500/30' : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'}>
                        {j.active ? 'running' : 'frozen'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{last ? `${last.status} · ${new Date(last.start_time).toLocaleString()}` : '—'}</TableCell>
                  </TableRow>
                );
              })}
              {(cron?.jobs.length ?? 0) === 0 && <TableRow><TableCell colSpan={4} className="text-xs text-muted-foreground">No cron data available.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Disabled features savings */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Disabled modules ({disabledFeatures.length}) — estimated savings</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Reads prevented / visit" value={savedReads} tone="text-emerald-600" />
            <Stat label="Egress saved / visit" value={`${savedKb} KB`} tone="text-emerald-600" />
            <Stat label="Egress saved / 1k visits" value={`${(savedKb / 1024).toFixed(1)} MB`} tone="text-emerald-600" />
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {disabledFeatures.map((f) => <Badge key={f.key} variant="outline" className="text-[10px]">{f.label}</Badge>)}
          </div>
        </CardContent>
      </Card>

      {/* Detectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Repeat className="h-4 w-4" />Polling / loop detector</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {polling.length === 0 && <div className="text-xs text-muted-foreground">No repeating request pattern in the last 60s.</div>}
            {polling.map((p: any) => (
              <div key={p.path} className="flex justify-between text-xs font-mono"><span className="truncate">{p.path}</span><span className="text-rose-600">{p.perMin}/min</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Duplicate request detector</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {duplicates.length === 0 && <div className="text-xs text-muted-foreground">No duplicated paths in the last 60s.</div>}
            {duplicates.map(([path, n]) => (
              <div key={path} className="flex justify-between text-xs font-mono"><span className="truncate">{path}</span><span className="text-amber-600">×{n}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Inventory */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Background request inventory ({BACKGROUND_INVENTORY.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead><TableHead>Source</TableHead><TableHead>Reason</TableHead>
                <TableHead>Frequency</TableHead><TableHead>Tables</TableHead><TableHead>Reads</TableHead>
                <TableHead>Writes</TableHead><TableHead>Cache</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BACKGROUND_INVENTORY.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="text-xs font-medium">{r.name}</TableCell>
                  <TableCell className="text-[10px] font-mono text-muted-foreground max-w-[200px] truncate">{r.source}</TableCell>
                  <TableCell className="text-xs">{r.reason}</TableCell>
                  <TableCell className="text-xs">{r.frequency}</TableCell>
                  <TableCell className="text-[10px] font-mono">{r.tables.join(', ') || '—'}</TableCell>
                  <TableCell className="text-xs">{r.reads}</TableCell>
                  <TableCell className="text-xs">{r.writes}</TableCell>
                  <TableCell className="text-xs">{r.cache}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${STATUS_TONE[r.status]}`}>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Request timeline (last 50)</CardTitle></CardHeader>
        <CardContent className="max-h-[320px] overflow-y-auto space-y-1">
          {recent.length === 0 && <div className="text-xs text-muted-foreground">Idle — nothing intercepted.</div>}
          {recent.map((r: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-[11px] font-mono border-b border-border/40 py-1">
              <span className="truncate max-w-[55%]">{r.path}</span>
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px]">{r.source}</Badge>
                <span className="text-muted-foreground">{r.ms}ms</span>
                <span className="text-muted-foreground">{new Date(r.at).toLocaleTimeString()}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default InfrastructureAudit;
