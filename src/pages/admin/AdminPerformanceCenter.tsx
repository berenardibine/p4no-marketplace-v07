// P4NO Performance Center (V1 Performance Engine)
// -------------------------------------------------
// Single-page monitoring surface for the request/egress firewall:
//   • CDN vs IndexedDB vs Supabase traffic mix (from cdnGuard)
//   • Requests prevented by the Data Access Manager (memory + dedupe)
//   • Static coverage snapshot (manifest size, queue depth)
//   • Estimated egress + cost saved
//
// All reads are event-driven — one fetch on mount + manual refresh.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Gauge,
  Database,
  Cloud,
  HardDrive,
  Layers,
  Zap,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Activity,
} from "lucide-react";
import {
  getGuardStats,
  subscribeGuardStats,
} from "@/lib/cdnGuard";
import { getDataAccessStats } from "@/lib/dataAccess";
import { getApiFirewallStats } from "@/lib/apiFirewall";

interface Snapshot {
  manifestVersion: number | null;
  manifestSize: number;
  totalManifestBytes: number;
  queueDepth: number;
  queueProcessing: number;
  queueFailed: number;
  loopHits: number;
  today: {
    filesGenerated: number;
    filesSkipped: number;
    bytesWritten: number;
    bytesSaved: number;
    errors: number;
  };
}

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${u[i]}`;
}

const AVG_ROW_BYTES = 1200; // rough Supabase row payload
const COST_PER_GB = 0.09;   // Supabase egress $/GB (public estimate)

export default function AdminPerformanceCenter() {
  const [guard, setGuard] = useState(getGuardStats());
  const [dam, setDam] = useState(getDataAccessStats());
  const [fw, setFw] = useState(getApiFirewallStats());
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeGuardStats(() => {
      setGuard(getGuardStats());
      setDam(getDataAccessStats());
      setFw(getApiFirewallStats());
    });
    // No timers: firewall numbers are pulled on every guard event and on the
    // manual Refresh button. A polling loop here would itself be background work.
    return () => { unsub(); };
  }, []);


  const load = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [manifestRes, queuedRes, processingRes, failedRes, loopRes, dailyRes] =
        await Promise.all([
          supabase
            .from("static_manifest")
            .select("version,size", { count: "exact" })
            .order("version", { ascending: false })
            .limit(500),
          supabase.from("generation_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
          supabase.from("generation_queue").select("id", { count: "exact", head: true }).eq("status", "processing"),
          supabase.from("generation_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
          supabase.from("loop_guard").select("count", { count: "exact", head: true }),
          supabase.from("generation_metrics_daily").select("*").eq("day", today).maybeSingle(),
        ]);

      const manifest = (manifestRes.data || []) as Array<{ version: number; size: number | null }>;
      const totalBytes = manifest.reduce((sum, m) => sum + (m.size || 0), 0);
      const version = manifest[0]?.version ?? null;

      const daily = (dailyRes.data || {}) as any;
      setSnap({
        manifestVersion: version,
        manifestSize: manifestRes.count ?? manifest.length,
        totalManifestBytes: totalBytes,
        queueDepth: queuedRes.count ?? 0,
        queueProcessing: processingRes.count ?? 0,
        queueFailed: failedRes.count ?? 0,
        loopHits: loopRes.count ?? 0,
        today: {
          filesGenerated: daily.files_generated ?? 0,
          filesSkipped: daily.files_skipped ?? 0,
          bytesWritten: daily.bytes_written ?? 0,
          bytesSaved: daily.bytes_saved ?? 0,
          errors: daily.errors ?? 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const staticServed = guard.browser + guard.cdn + guard.blob;
  const totalServed = staticServed + guard.supabase;
  const staticPct = totalServed > 0 ? (staticServed / totalServed) * 100 : 100;

  // Requests prevented (memory hits + dedupes + IndexedDB serves + CDN serves)
  const requestsPrevented = dam.saved + guard.browser + guard.cdn;

  // Rough egress saved: bytes not read from Supabase (avg row * hits)
  const bytesSaved =
    requestsPrevented * AVG_ROW_BYTES + (snap?.today.bytesSaved ?? 0);
  const costSaved = (bytesSaved / (1024 ** 3)) * COST_PER_GB;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            Performance Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Live snapshot of egress prevention, cache efficiency, and static coverage.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Static coverage"
          value={`${staticPct.toFixed(1)}%`}
          hint={`${staticServed} of ${totalServed || 0} public reads`}
          tone={staticPct >= 95 ? "good" : staticPct >= 80 ? "warn" : "bad"}
        />
        <Kpi
          icon={<Zap className="h-4 w-4" />}
          label="Requests prevented"
          value={requestsPrevented.toLocaleString()}
          hint={`${dam.dedupes} dedupes · ${dam.hits} memory hits`}
          tone="good"
        />
        <Kpi
          icon={<DollarSign className="h-4 w-4" />}
          label="Egress saved"
          value={fmtBytes(bytesSaved)}
          hint={`≈ $${costSaved.toFixed(4)} today`}
          tone="good"
        />
        <Kpi
          icon={<Database className="h-4 w-4" />}
          label="Supabase reads"
          value={guard.supabase.toLocaleString()}
          hint={`${guard.violations} strict-mode violations`}
          tone={guard.violations > 0 ? "warn" : "good"}
        />
      </div>

      {/* Traffic mix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" /> Traffic mix (session)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="IndexedDB (browser)" value={guard.browser} total={totalServed} icon={<HardDrive className="h-3.5 w-3.5" />} />
          <Row label="Vercel CDN" value={guard.cdn} total={totalServed} icon={<Cloud className="h-3.5 w-3.5" />} />
          <Row label="Blob storage" value={guard.blob} total={totalServed} icon={<Layers className="h-3.5 w-3.5" />} />
          <Row label="Supabase (fallback)" value={guard.supabase} total={totalServed} icon={<Database className="h-3.5 w-3.5" />} tone="bad" />
        </CardContent>
      </Card>

      {/* Data Access Manager */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" /> Data Access Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Memory hits" value={dam.hits} />
          <Stat label="Dedupes" value={dam.dedupes} />
          <Stat label="Fetches executed" value={dam.misses} />
          <Stat label="Cache entries" value={dam.entries} />
          <Stat label="Hit rate" value={`${dam.hitRate.toFixed(1)}%`} />
        </CardContent>
      </Card>

      {/* API Request Firewall */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> API Request Firewall
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="PostgREST reads" value={fw.totalReads.toLocaleString()} />
            <Stat label="PostgREST writes" value={fw.totalWrites.toLocaleString()} />
            <Stat label="Blocked (strict)" value={fw.totalBlocked.toLocaleString()} tone={fw.totalBlocked ? "warn" : undefined} />
            <Stat label="Tables touched" value={fw.tables} />
          </div>
          {fw.top.length > 0 && (
            <div className="space-y-1 text-sm font-mono">
              <div className="text-xs uppercase text-muted-foreground mb-1">Top tables (session)</div>
              {fw.top.map((t) => (
                <div key={t.table} className="flex items-center justify-between border-b py-1 last:border-0 gap-3">
                  <span className="truncate flex-1">{t.table}</span>
                  <span className="text-xs text-muted-foreground">{t.avgMs}ms</span>
                  {t.blocked > 0 && <Badge variant="destructive">{t.blocked} blocked</Badge>}
                  {t.errors > 0 && <Badge variant="destructive">{t.errors} err</Badge>}
                  <Badge variant="secondary">R {t.reads}</Badge>
                  <Badge variant="outline">W {t.writes}</Badge>
                </div>
              ))}
            </div>
          )}
          {fw.polling.length > 0 && (
            <div className="rounded-md border border-amber-500/40 p-3 bg-amber-500/5">
              <div className="flex items-center gap-2 text-amber-600 text-sm font-medium mb-1">
                <AlertTriangle className="h-4 w-4" /> Table polling detected (last 60s)
              </div>
              <div className="space-y-1 text-xs font-mono">
                {fw.polling.map((p) => (
                  <div key={p.table} className="flex items-center justify-between">
                    <span>{p.table}</span>
                    <Badge variant="destructive">{p.perMin}/min</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Every PostgREST call in the browser is intercepted at fetch level. In strict static mode
            public-table reads are refused at the network boundary (returned as empty arrays) so a
            regressed hook cannot leak egress.
          </p>
        </CardContent>
      </Card>

      {/* Static engine snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" /> Static engine
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Manifest version" value={snap?.manifestVersion ?? "—"} />
          <Stat label="Manifest entries" value={snap?.manifestSize ?? 0} />
          <Stat label="Manifest bytes" value={fmtBytes(snap?.totalManifestBytes ?? 0)} />
          <Stat label="Queue depth" value={snap?.queueDepth ?? 0} />
          <Stat label="Processing" value={snap?.queueProcessing ?? 0} />
          <Stat label="Failed" value={snap?.queueFailed ?? 0} tone={snap?.queueFailed ? "warn" : undefined} />
          <Stat label="Loop hits" value={snap?.loopHits ?? 0} tone={snap?.loopHits ? "warn" : undefined} />
          <Stat label="Generated today" value={snap?.today.filesGenerated ?? 0} />
          <Stat label="Skipped (no-op)" value={snap?.today.filesSkipped ?? 0} />
          <Stat label="Errors today" value={snap?.today.errors ?? 0} tone={snap?.today.errors ? "bad" : undefined} />
        </CardContent>
      </Card>

      {/* Polling detection */}
      {guard.polling && guard.polling.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" /> Polling detected (last 60s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm font-mono">
              {guard.polling.map((p) => (
                <div key={p.path} className="flex items-center justify-between border-b py-1 last:border-0">
                  <span className="truncate">{p.path}</span>
                  <Badge variant="destructive">{p.perMin}/min</Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Any public path served &gt;10×/min from a single session is likely a client-side polling loop.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Top endpoints (session)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!guard.top || guard.top.length === 0) ? (
            <p className="text-sm text-muted-foreground">No traffic recorded yet.</p>
          ) : (
            <div className="space-y-1 text-sm font-mono">
              {guard.top.map((t) => (
                <div key={t.path} className="flex items-center justify-between border-b py-1 last:border-0 gap-3">
                  <span className="truncate flex-1">{t.path}</span>
                  <span className="text-xs text-muted-foreground">{t.lastMs}ms</span>
                  {t.supabase > 0 && <Badge variant="destructive">{t.supabase} db</Badge>}
                  <Badge variant="secondary">{t.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Session counters reset on reload. Daily counters come from{" "}
        <code>generation_metrics_daily</code>. Cost model: $
        {COST_PER_GB}/GB, avg {AVG_ROW_BYTES} B/row.
      </p>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone = "good",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-red-600";
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 text-xs ${color}`}>
          {icon}
          <span>{label}</span>
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  total,
  icon,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  icon: React.ReactNode;
  tone?: "bad";
}) {
  const p = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={tone === "bad" ? "text-red-600 font-medium" : "font-medium"}>
          {value.toLocaleString()} · {p.toFixed(1)}%
        </span>
      </div>
      <Progress value={p} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "warn" | "bad";
}) {
  const color =
    tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}