// Static Architecture V3 — read-only monitoring dashboard.
// Answers: "is the site actually served from static, and how much
// PostgREST traffic did we avoid?"
//
// All data comes from tables already populated by the V2 engine:
//   cdn_metrics, static_manifest, generation_queue,
//   generation_metrics_daily, loop_guard.
// No writes, no polling — one fetch on mount + a manual refresh button.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Cloud, HardDrive, Database, ShieldAlert, Layers, DollarSign, Gauge } from "lucide-react";

interface MetricRow {
  path: string;
  source: "browser" | "cdn" | "blob" | "supabase";
  ms: number | null;
  violation: boolean;
  created_at: string;
}

interface ManifestRow {
  path: string;
  version: number;
  size: number;
  hash: string;
  generated_at: string;
}

interface DailyMetric {
  day: string;
  files_generated: number;
  files_skipped: number;
  bytes_written: number;
  bytes_saved: number;
  errors: number;
  loops_detected: number;
}

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${u[i]}`;
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export default function AdminStaticArchitecture() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [manifest, setManifest] = useState<ManifestRow[]>([]);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [loops, setLoops] = useState(0);

  async function load() {
    setLoading(true);
    const [m, mf, d, q, lg] = await Promise.all([
      supabase
        .from("cdn_metrics")
        .select("path,source,ms,violation,created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("static_manifest")
        .select("path,version,size,hash,generated_at")
        .order("generated_at", { ascending: false })
        .limit(500),
      supabase
        .from("generation_metrics_daily")
        .select("*")
        .order("day", { ascending: false })
        .limit(14),
      supabase
        .from("generation_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("loop_guard")
        .select("count")
        .gte("minute_bucket", new Date(Date.now() - 60 * 60 * 1000).toISOString()),
    ]);
    setMetrics((m.data as MetricRow[]) ?? []);
    setManifest((mf.data as ManifestRow[]) ?? []);
    setDaily((d.data as DailyMetric[]) ?? []);
    setQueueSize(q.count ?? 0);
    setLoops(((lg.data as { count: number }[]) ?? []).reduce((a, r) => a + (r.count ?? 0), 0));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const t = { browser: 0, cdn: 0, blob: 0, supabase: 0, violations: 0, totalMs: 0 };
    for (const r of metrics) {
      t[r.source] = (t[r.source] ?? 0) + 1;
      if (r.violation) t.violations++;
      t.totalMs += r.ms ?? 0;
    }
    return t;
  }, [metrics]);

  const total = totals.browser + totals.cdn + totals.blob + totals.supabase;
  const staticShare = pct(totals.browser + totals.cdn + totals.blob, total);
  const dbShare = pct(totals.supabase, total);
  const cdnHit = pct(totals.cdn, total);
  const idbHit = pct(totals.browser, total);

  const topRequested = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of metrics) c.set(r.path, (c.get(r.path) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [metrics]);

  const topMissing = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of metrics) {
      if (r.violation) c.set(r.path, (c.get(r.path) ?? 0) + 1);
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [metrics]);

  const manifestVersion = manifest[0]?.version ?? 0;
  const totalManifestBytes = manifest.reduce((a, r) => a + (r.size ?? 0), 0);
  const avgFileSize = manifest.length ? totalManifestBytes / manifest.length : 0;

  const savings = useMemo(() => {
    // Rough egress estimate: each avoided PostgREST call ≈ 4KB row payload.
    const avoided = totals.browser + totals.cdn + totals.blob;
    const bytes = avoided * 4096;
    // Supabase egress ≈ $0.09/GB.
    const dollars = (bytes / 1024 / 1024 / 1024) * 0.09;
    return { avoided, bytes, dollars };
  }, [totals]);

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Static Architecture</h1>
          <p className="text-sm text-muted-foreground">
            Live view of the CDN-first read pipeline. Target: ≥99% static, &lt;1% PostgREST.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Health headline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Gauge className="h-3 w-3" /> Static coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staticShare}%</div>
            <Progress value={staticShare} className="mt-1 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" /> DB reads (public)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dbShare}%</div>
            <div className="text-xs text-muted-foreground">
              {totals.supabase} of {total} reads
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Blocked requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.violations}</div>
            <div className="text-xs text-muted-foreground">Guard-detected fallbacks</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Est. egress saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${savings.dollars.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">
              {fmtBytes(savings.bytes)} across {savings.avoided.toLocaleString()} hits
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic mix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" /> Traffic mix
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: "Browser (IndexedDB)", key: "browser", value: totals.browser, share: idbHit },
            { label: "CDN", key: "cdn", value: totals.cdn, share: cdnHit },
            { label: "Blob (self-heal)", key: "blob", value: totals.blob, share: pct(totals.blob, total) },
            { label: "Supabase (fallback)", key: "supabase", value: totals.supabase, share: dbShare },
          ].map((row) => (
            <div key={row.key} className="flex items-center gap-3">
              <div className="w-40 text-xs">{row.label}</div>
              <Progress value={row.share} className="h-2 flex-1" />
              <div className="w-20 text-xs text-right tabular-nums">
                {row.share}% · {row.value.toLocaleString()}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Manifest + queue */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> Manifest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Version</span><span className="tabular-nums">{manifestVersion}</span></div>
            <div className="flex justify-between"><span>Files tracked</span><span className="tabular-nums">{manifest.length}</span></div>
            <div className="flex justify-between"><span>Total size</span><span className="tabular-nums">{fmtBytes(totalManifestBytes)}</span></div>
            <div className="flex justify-between"><span>Avg file size</span><span className="tabular-nums">{fmtBytes(avgFileSize)}</span></div>
            <div className="flex justify-between">
              <span>Last publish</span>
              <span className="text-xs text-muted-foreground">
                {manifest[0]?.generated_at ? new Date(manifest[0].generated_at).toLocaleString() : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-4 w-4" /> Generation engine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Queue depth</span>
              <Badge variant={queueSize > 50 ? "destructive" : "secondary"}>{queueSize}</Badge>
            </div>
            <div className="flex justify-between"><span>Loop-guard hits (60m)</span>
              <Badge variant={loops > 0 ? "destructive" : "outline"}>{loops}</Badge>
            </div>
            <div className="flex justify-between"><span>Files generated (today)</span><span className="tabular-nums">{daily[0]?.files_generated ?? 0}</span></div>
            <div className="flex justify-between"><span>Files skipped (dirty-check)</span><span className="tabular-nums">{daily[0]?.files_skipped ?? 0}</span></div>
            <div className="flex justify-between"><span>Bytes written (today)</span><span className="tabular-nums">{fmtBytes(daily[0]?.bytes_written ?? 0)}</span></div>
            <div className="flex justify-between"><span>Bytes saved (today)</span><span className="tabular-nums">{fmtBytes(daily[0]?.bytes_saved ?? 0)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Top requested + missing */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Top requested static paths</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {topRequested.length === 0 && <div className="text-muted-foreground">No traffic yet.</div>}
            {topRequested.map(([p, c]) => (
              <div key={p} className="flex justify-between gap-2 border-b py-1">
                <span className="truncate">{p}</span>
                <span className="tabular-nums text-muted-foreground">{c}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top violations (missing / fallback)</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {topMissing.length === 0 && <div className="text-muted-foreground">Clean — no violations recorded.</div>}
            {topMissing.map(([p, c]) => (
              <div key={p} className="flex justify-between gap-2 border-b py-1">
                <span className="truncate">{p}</span>
                <span className="tabular-nums text-red-500">{c}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}