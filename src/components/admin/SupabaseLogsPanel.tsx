import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pause, Play, RefreshCw } from 'lucide-react';

type Src = 'postgrest' | 'edge-function' | 'cron' | 'generator' | 'system';

interface LogEntry {
  id: string;
  at: string;
  source: Src;
  event: string;
  status: string;
  latency: number | null;
  table: string | null;
  rows: number | null;
  actor: string | null;
}

const TONE: Record<Src, string> = {
  postgrest: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
  'edge-function': 'bg-violet-500/15 text-violet-600 border-violet-500/30',
  cron: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  generator: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  system: 'bg-muted text-muted-foreground border-border',
};

const REFRESH_MS = 15_000;

const SupabaseLogsPanel = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [livePaused, setLivePaused] = useState(true); // paused by default: live mode costs reads
  const [filter, setFilter] = useState<Src | 'all'>('all');
  const [lastLoad, setLastLoad] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const out: LogEntry[] = [];
    try {
      const [gen, cdn, sys, cron] = await Promise.all([
        (supabase as any).from('static_gen_log').select('id, entity, slug, ok, error, created_at, version').order('created_at', { ascending: false }).limit(40),
        (supabase as any).from('cdn_metrics').select('id, path, source, ms, status, violation, created_at').order('created_at', { ascending: false }).limit(40),
        (supabase as any).from('system_logs').select('*').order('created_at', { ascending: false }).limit(30),
        (supabase as any).rpc('infra_audit_cron'),
      ]);

      for (const r of gen?.data ?? []) {
        out.push({
          id: `gen-${r.id}`, at: r.created_at, source: 'generator',
          event: `generate ${r.entity}${r.slug ? `/${r.slug}` : ''}`,
          status: r.ok ? '200' : `error: ${String(r.error ?? '').slice(0, 60)}`,
          latency: null, table: 'static_manifest', rows: null, actor: 'static-worker',
        });
      }
      for (const r of cdn?.data ?? []) {
        out.push({
          id: `cdn-${r.id}`, at: r.created_at,
          source: r.source === 'supabase' ? 'postgrest' : 'edge-function',
          event: `GET ${r.path}`, status: String(r.status ?? '—'),
          latency: r.ms ?? null, table: r.source === 'supabase' ? 'products' : null,
          rows: null, actor: r.violation ? 'violation' : 'visitor',
        });
      }
      for (const r of sys?.data ?? []) {
        out.push({
          id: `sys-${r.id}`, at: r.created_at ?? new Date().toISOString(), source: 'system',
          event: String(r.event ?? r.message ?? r.level ?? 'log').slice(0, 90),
          status: String(r.level ?? 'info'), latency: null, table: null, rows: null, actor: 'system',
        });
      }
      for (const r of (cron?.data?.runs ?? []) as any[]) {
        const job = ((cron?.data?.jobs ?? []) as any[]).find((j) => j.jobid === r.jobid);
        out.push({
          id: `cron-${r.runid}`, at: r.start_time, source: 'cron',
          event: job?.jobname ?? `job ${r.jobid}`, status: r.status,
          latency: r.end_time ? new Date(r.end_time).getTime() - new Date(r.start_time).getTime() : null,
          table: null, rows: null, actor: 'pg_cron',
        });
      }
    } catch {
      /* ignore — panel is diagnostic only */
    }
    out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    setLogs(out.slice(0, 300));
    setLastLoad(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (livePaused) { if (timer.current) clearInterval(timer.current); return; }
    timer.current = setInterval(() => { void load(); }, REFRESH_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [livePaused, load]);

  const shown = filter === 'all' ? logs : logs.filter((l) => l.source === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={livePaused ? 'outline' : 'default'} onClick={() => setLivePaused((v) => !v)}>
          {livePaused ? <Play className="h-3.5 w-3.5 mr-1" /> : <Pause className="h-3.5 w-3.5 mr-1" />}
          {livePaused ? 'Resume live' : 'Pause live'}
        </Button>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
        {(['all', 'postgrest', 'edge-function', 'cron', 'generator', 'system'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'secondary' : 'ghost'} onClick={() => setFilter(f)} className="text-xs h-7">{f}</Button>
        ))}
        <span className="text-[11px] text-muted-foreground ml-auto">
          {lastLoad ? `Loaded ${lastLoad.toLocaleTimeString()}` : '—'} · live refresh every {REFRESH_MS / 1000}s when resumed
        </span>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Supabase activity log ({shown.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead><TableHead>Source</TableHead><TableHead>Event</TableHead>
                <TableHead>Status</TableHead><TableHead>Latency</TableHead><TableHead>Table</TableHead><TableHead>Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-[11px] whitespace-nowrap">{new Date(l.at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${TONE[l.source]}`}>{l.source}</Badge></TableCell>
                  <TableCell className="text-[11px] font-mono max-w-[320px] truncate">{l.event}</TableCell>
                  <TableCell className="text-[11px]">{l.status}</TableCell>
                  <TableCell className="text-[11px]">{l.latency != null ? `${l.latency}ms` : '—'}</TableCell>
                  <TableCell className="text-[11px] font-mono">{l.table ?? '—'}</TableCell>
                  <TableCell className="text-[11px]">{l.actor ?? '—'}</TableCell>
                </TableRow>
              ))}
              {shown.length === 0 && <TableRow><TableCell colSpan={7} className="text-xs text-muted-foreground">No log entries.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseLogsPanel;
