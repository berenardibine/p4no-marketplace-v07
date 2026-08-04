import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Copy, Layers, Gauge, SkipForward, Repeat } from "lucide-react";

interface DayMetrics {
  day: string;
  events_processed: number;
  generations_run: number;
  duplicate_generations: number;
  duplicate_requests: number;
  duplicate_enqueues: number;
  files_generated: number;
  files_skipped: number;
  errors: number;
}

interface LogRow {
  id: number;
  entity: string | null;
  event_id: string | null;
  generation_id: string | null;
  created_at: string;
  ok: boolean | null;
  duration_ms: number | null;
}

const ZERO: DayMetrics = {
  day: "", events_processed: 0, generations_run: 0, duplicate_generations: 0,
  duplicate_requests: 0, duplicate_enqueues: 0, files_generated: 0,
  files_skipped: 0, errors: 0,
};

/**
 * Duplicate-execution monitor for the Single Event Architecture.
 * Target: 1 event = 1 generation. Loads strictly on demand (no polling).
 */
export default function GeneratorDedupPanel() {
  const [days, setDays] = useState<DayMetrics[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const [m, l] = await Promise.all([
      supabase.from("generation_metrics_daily").select("*").gte("day", since).order("day", { ascending: false }),
      supabase.from("static_gen_log")
        .select("id,entity,event_id,generation_id,created_at,ok,duration_ms")
        .order("created_at", { ascending: false }).limit(100),
    ]);
    setDays(((m.data as any[]) ?? []).map((d) => ({ ...ZERO, ...d })));
    setLogs(((l.data as any[]) ?? []) as LogRow[]);
    setLoaded(true);
    setLoading(false);
  }, []);

  const totals = useMemo(() => {
    const t = days.reduce((a, d) => ({
      ...ZERO,
      events_processed: a.events_processed + (d.events_processed ?? 0),
      generations_run: a.generations_run + (d.generations_run ?? 0),
      duplicate_generations: a.duplicate_generations + (d.duplicate_generations ?? 0),
      duplicate_requests: a.duplicate_requests + (d.duplicate_requests ?? 0),
      duplicate_enqueues: a.duplicate_enqueues + (d.duplicate_enqueues ?? 0),
      files_generated: a.files_generated + (d.files_generated ?? 0),
      files_skipped: a.files_skipped + (d.files_skipped ?? 0),
      errors: a.errors + (d.errors ?? 0),
    }), ZERO);
    const events = t.events_processed || 0;
    const runs = t.generations_run || 0;
    const perEvent = events > 0 ? runs / events : 0;
    // 100% when every event produced exactly one generation.
    const efficiency = runs > 0 ? Math.min(100, Math.round((events / runs) * 100)) : 100;
    return { ...t, perEvent, efficiency };
  }, [days]);

  // Duplicate event_ids actually observed in the log (should always be 0).
  const duplicateEventIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of logs) {
      if (!l.event_id) continue;
      counts.set(l.event_id, (counts.get(l.event_id) ?? 0) + 1);
    }
    return Array.from(counts.entries()).filter(([, n]) => n > 1);
  }, [logs]);

  const stat = (label: string, value: string | number, Icon: any, tone?: "good" | "bad") => (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${tone === "bad" ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <div className={`text-2xl font-semibold mt-1 ${tone === "bad" ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Duplicate Execution Monitor</h3>
          <p className="text-xs text-muted-foreground">Target: 1 event = 1 generation (last 7 days)</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          {loaded ? "Refresh" : "Load"}
        </Button>
      </div>

      {!loaded ? (
        <p className="text-xs text-muted-foreground">Press Load to query generator metrics on demand.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {stat("Events processed", totals.events_processed, Layers)}
            {stat("Generations run", totals.generations_run, Repeat)}
            {stat(
              "Avg generations / event",
              totals.perEvent.toFixed(2),
              Gauge,
              totals.perEvent > 1.05 ? "bad" : undefined,
            )}
            {stat(
              "Duplicate generators skipped",
              totals.duplicate_generations,
              SkipForward,
            )}
            {stat("Duplicate requests skipped", totals.duplicate_requests, SkipForward)}
            {stat("Skipped duplicate jobs (queue)", totals.duplicate_enqueues, SkipForward)}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Generator efficiency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={totals.efficiency} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{totals.efficiency}% — one generation per event</span>
                <span>{totals.files_generated} files written · {totals.files_skipped} unchanged</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Duplicate event IDs in recent log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {duplicateEventIds.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  None — every logged event ran exactly once.
                </p>
              ) : (
                <div className="space-y-1">
                  {duplicateEventIds.map(([eid, n]) => (
                    <div key={eid} className="flex items-center justify-between text-xs font-mono">
                      <span className="truncate">{eid}</span>
                      <Badge variant="destructive">{n}×</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent generations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-72 overflow-auto">
              {logs.slice(0, 30).map((l) => (
                <div key={l.id} className="flex items-center justify-between text-xs border-b border-border/40 py-1">
                  <span className="truncate max-w-[45%]">{l.entity ?? "—"}</span>
                  <span className="font-mono text-muted-foreground truncate max-w-[30%]">
                    {l.event_id?.slice(0, 10) ?? "legacy"}
                  </span>
                  <span className="text-muted-foreground">{l.duration_ms ?? 0}ms</span>
                  <Badge variant={l.ok === false ? "destructive" : "secondary"}>
                    {l.ok === false ? "error" : "ok"}
                  </Badge>
                </div>
              ))}
              {logs.length === 0 && <p className="text-xs text-muted-foreground">No generations logged.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
