import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STATIC_CDN, isStrictStaticMode, setStrictStaticMode } from "@/lib/staticFlags";
import { getGuardStats, subscribeGuardStats, repairIndexedDB } from "@/lib/cdnGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import InfrastructureAudit from "@/components/admin/InfrastructureAudit";
import SupabaseLogsPanel from "@/components/admin/SupabaseLogsPanel";
import GeneratorDedupPanel from "@/components/admin/GeneratorDedupPanel";

import {
  Activity, Database, Cloud, RefreshCw, Zap, HardDrive, Clock,
  CheckCircle2, AlertTriangle, XCircle, Download, FileJson, Play,
  Layers, Boxes, Newspaper, Video, Tag, Search as SearchIcon,
  Shield, Wifi, TrendingDown, TrendingUp, Sparkles, Gauge, DollarSign,
  FileDown, Server, Globe,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, BarChart, Bar,
} from "recharts";

// ---- Types ----
interface MetricRow {
  id: number; path: string; source: 'browser' | 'cdn' | 'blob' | 'supabase';
  ms: number | null; status: number | null; violation: boolean; created_at: string;
}
interface Manifest { version: number; entities: Record<string, number> }
interface LogRow {
  id: number; entity: string; slug: string | null; category: string | null;
  paths: string[] | null; version: number | null; ok: boolean;
  error: string | null; created_at: string;
}
interface BlobFile { path: string; url: string; size?: number; version: number; updatedAt?: string; }
type EntityKind = "all" | "product" | "service" | "reel" | "article" | "category";

// ---- Helpers ----
const fmtBytes = (n?: number) => {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};
const fmtTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
};
const relTime = (iso?: string | null) => {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "—";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);
// Rough estimate: 12 KB per Supabase query avoided; $0.09/GB egress
const estimateBytesSaved = (avoidedRequests: number) => avoidedRequests * 12 * 1024;
const estimateCostSaved = (bytes: number) => (bytes / 1024 / 1024 / 1024) * 0.09;

// ---- Small UI ----
function Stat({ label, value, hint, icon: Icon, tone = "default", trend }: {
  label: string; value: React.ReactNode; hint?: string;
  icon?: any; tone?: "default" | "good" | "warn" | "bad" | "primary";
  trend?: { dir: "up" | "down" | "flat"; text: string };
}) {
  const toneCls = {
    default: "text-foreground",
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    bad: "text-red-600 dark:text-red-400",
    primary: "text-primary",
  }[tone];
  return (
    <Card className="relative overflow-hidden border-border/60 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span className="truncate">{label}</span>
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        </div>
        <div className={`text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
        {(hint || trend) && (
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
            {trend && (
              <span className={`flex items-center gap-0.5 ${
                trend.dir === "up" ? "text-emerald-600" : trend.dir === "down" ? "text-red-600" : ""
              }`}>
                {trend.dir === "up" ? <TrendingUp className="h-3 w-3" /> :
                  trend.dir === "down" ? <TrendingDown className="h-3 w-3" /> : null}
                {trend.text}
              </span>
            )}
            {hint && <span>{hint}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HealthDot({ status, reason }: { status: "healthy" | "warning" | "error" | "unknown"; reason?: string }) {
  const map = {
    healthy: { c: "bg-emerald-500", Icon: CheckCircle2, label: "Healthy" },
    warning: { c: "bg-amber-500", Icon: AlertTriangle, label: "Warning" },
    error: { c: "bg-red-500", Icon: XCircle, label: "Error" },
    unknown: { c: "bg-muted", Icon: Activity, label: "Unknown" },
  } as const;
  const { c, Icon, label } = map[status];
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${c} animate-pulse`} />
        <Icon className="h-3.5 w-3.5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {reason && <div className="text-[11px] text-muted-foreground mt-0.5 ml-4.5">{reason}</div>}
    </div>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  browser: "hsl(142 71% 45%)",
  cdn: "hsl(199 89% 48%)",
  blob: "hsl(262 83% 58%)",
  supabase: "hsl(0 84% 60%)",
};

// ---- Page ----
export default function AdminCacheMonitor() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [prevManifest, setPrevManifest] = useState<Manifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [blobFiles, setBlobFiles] = useState<BlobFile[]>([]);
  const [blobLoading, setBlobLoading] = useState(false);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [metrics24h, setMetrics24h] = useState<MetricRow[]>([]);
  const [dbCounts, setDbCounts] = useState<Record<string, number>>({});
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const [, setGuardTick] = useState(0);

  useEffect(() => subscribeGuardStats(() => setGuardTick((t) => t + 1)), []);

  // ---- Data loading ----
  const loadMetrics = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: recent }, { data: last24 }] = await Promise.all([
      supabase.from("cdn_metrics").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("cdn_metrics").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
    ]);
    setMetrics((recent as MetricRow[]) ?? []);
    setMetrics24h((last24 as MetricRow[]) ?? []);
  }, []);

  const loadManifest = useCallback(async () => {
    setManifestLoading(true);
    try {
      let m: any = null;
      if (STATIC_CDN.base) {
        const r = await fetch(`${STATIC_CDN.base}/manifest.json`, { cache: "no-store" });
        if (r.ok) m = await r.json();
      }
      if (!m || !m.entities) {
        const { data } = await supabase.functions.invoke("static-manifest", { method: "GET" as any });
        if (data && typeof data === "object" && "entities" in (data as any)) m = data;
      }
      if (m && m.entities) {
        setManifest((old) => { setPrevManifest(old); return m as Manifest; });
      }
    } catch { /* ignore */ }
    finally { setManifestLoading(false); }
  }, []);


  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    const { data } = await supabase.from("static_gen_log").select("*")
      .order("created_at", { ascending: false }).limit(200);
    setLogs((data as LogRow[]) ?? []);
    setLogsLoading(false);
  }, []);

  const loadDbCounts = useCallback(async () => {
    const tables = ["products", "services", "insight_articles", "reels", "categories"] as const;
    const results = await Promise.all(tables.map(async (t) => {
      try {
        const { count } = await supabase.from(t as any).select("*", { count: "exact", head: true });
        return [t, count || 0] as const;
      } catch { return [t, 0] as const; }
    }));
    setDbCounts(Object.fromEntries(results));
  }, []);

  const loadStorage = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
    try {
      const est = await navigator.storage.estimate();
      setStorageInfo({ usage: est.usage || 0, quota: est.quota || 0 });
    } catch { /* ignore */ }
  }, []);

  const loadBlobFiles = useCallback(async (m: Manifest | null) => {
    if (!m || !STATIC_CDN.base) return;
    setBlobLoading(true);
    const entries = Object.entries(m.entities);
    const results = await Promise.all(entries.slice(0, 80).map(async ([path, version]) => {
      const url = `${STATIC_CDN.base}/${path}.json`;
      try {
        const r = await fetch(url, { method: "HEAD" });
        return {
          path, url, version,
          size: Number(r.headers.get("content-length") || 0),
          updatedAt: r.headers.get("last-modified") || undefined,
        } as BlobFile;
      } catch { return { path, url, version } as BlobFile; }
    }));
    setBlobFiles(results);
    setBlobLoading(false);
  }, []);

  // Mount does the cheapest possible work: manifest comes from the CDN (no DB),
  // storage estimate is browser-local. Heavy database reads (cdn_metrics,
  // static_gen_log, row counts, blob HEAD sweeps) run only on explicit Refresh.
  useEffect(() => {
    loadManifest(); loadStorage();
  }, [loadManifest, loadStorage]);

  // No auto-refresh timer and no on-mount DB reads: this admin page previously
  // polled the database every 15s per open tab.



  // ---- Actions ----
  const runAction = useCallback(async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    const started = Date.now();
    try {
      await fn();
      toast({ title: `${label} ✓`, description: `${Date.now() - started}ms` });
      await Promise.all([loadManifest(), loadLogs()]);
    } catch (e: any) {
      toast({ title: `${label} failed`, description: e?.message || String(e), variant: "destructive" });
    } finally { setBusy(null); }
  }, [loadManifest, loadLogs]);

  const generate = (entity: EntityKind) => runAction(`Generate ${entity}`, async () => {
    const { error } = await supabase.functions.invoke("static-generate", { body: { entity } });
    if (error) throw error;
  });
  const warm = (entity: EntityKind | "smart") => runAction(`Warm ${entity}`, async () => {
    const { error } = await supabase.functions.invoke("static-warm", { body: { entity } });
    if (error) throw error;
  });
  const invalidate = (entity: EntityKind) => runAction(`Invalidate ${entity}`, async () => {
    const { error } = await supabase.functions.invoke("static-generate", { body: { entity } });
    if (error) throw error;
  });

  const runIntegrity = (repair: boolean) => runAction(`Integrity ${repair ? "+ repair" : "scan"}`, async () => {
    const { data, error } = await supabase.functions.invoke("static-integrity", { body: { repair } });
    if (error) throw error;
    toast({ title: `Integrity: ${(data as any)?.missing_count ?? 0} missing`, description: repair ? `Repaired ${(data as any)?.repaired_count ?? 0}` : undefined });
  });
  const runCleanup = (dry: boolean) => runAction(`Cleanup ${dry ? "(dry)" : ""}`, async () => {
    const { data, error } = await supabase.functions.invoke("static-cleanup", { body: { dry } });
    if (error) throw error;
    toast({ title: `Cleanup: ${(data as any)?.candidates ?? 0} candidates`, description: dry ? "Dry run" : `Deleted ${(data as any)?.deleted ?? 0}` });
  });
  const runRebuildManifest = () => runAction("Rebuild manifest", async () => {
    const { data, error } = await supabase.functions.invoke("static-rebuild-manifest", { body: {} });
    if (error) throw error;
    toast({ title: `Manifest rebuilt`, description: `${(data as any)?.entries ?? 0} entries` });
    await loadManifest();
  });
  const runHealth = () => runAction("Health check", async () => {
    const { data, error } = await supabase.functions.invoke("static-health", { method: "GET" as any });
    if (error) throw error;
    toast({ title: `Health score: ${(data as any)?.health_score ?? "?"}/100`, description: `${(data as any)?.requests ?? 0} requests / 24h` });
  });
  const runConsistency = () => runAction("Consistency check", async () => {
    const { data, error } = await supabase.functions.invoke("static-consistency", { body: {} });
    if (error) throw error;
    const d = data as any;
    toast({
      title: `Drift: ${d?.drift?.length ?? 0}`,
      description: d?.repaired?.length ? `Repaired: ${d.repaired.join(", ")}` : "All surfaces in sync",
    });
    await loadManifest();
  });
  const runRepairIDB = () => runAction("Repair IndexedDB", async () => {
    await repairIndexedDB();
    toast({ title: "IndexedDB wiped", description: "Fresh state on next read." });
  });
  const [strict, setStrict] = useState(isStrictStaticMode());
  const toggleStrict = () => {
    const next = !strict;
    setStrictStaticMode(next);
    setStrict(next);
    toast({
      title: next ? "Strict static mode ON" : "Strict static mode OFF",
      description: next ? "Supabase fallback disabled for public reads." : "Fallback re-enabled.",
    });
  };


  // ---- Derived ----
  const entities = manifest?.entities ?? {};
  const totalFiles = Object.keys(entities).length;
  const byPrefix = useMemo(() => {
    const g: Record<string, number> = {};
    Object.keys(entities).forEach((p) => { const t = p.split("/")[0]; g[t] = (g[t] || 0) + 1; });
    return g;
  }, [entities]);

  const totalSize = blobFiles.reduce((s, b) => s + (b.size || 0), 0);
  const avgFileSize = blobFiles.length ? totalSize / blobFiles.length : 0;
  const largestFile = blobFiles.reduce<BlobFile | null>((m, f) =>
    !m || (f.size || 0) > (m.size || 0) ? f : m, null);

  const lastOk = logs.find((l) => l.ok);
  const lastFail = logs.find((l) => !l.ok);
  const successCount = logs.filter((l) => l.ok).length;
  const failCount = logs.filter((l) => !l.ok).length;
  const totalGenerated = logs.reduce((s, l) => s + (l.paths?.length || 0), 0);
  const avgGenMs = 0; // static_gen_log has no duration column
  const successRate = logs.length ? (successCount / logs.length) * 100 : 100;

  // Traffic aggregates (from cdn_metrics)
  const trafficAgg = useMemo(() => {
    const acc = { browser: 0, cdn: 0, blob: 0, supabase: 0, violations: 0, totalMs: 0, count: 0, maxMs: 0 };
    const latencies: number[] = [];
    for (const r of metrics24h) {
      acc[r.source] = (acc[r.source] || 0) + 1;
      if (r.violation) acc.violations += 1;
      const ms = r.ms || 0;
      acc.totalMs += ms;
      if (ms > acc.maxMs) acc.maxMs = ms;
      latencies.push(ms);
      acc.count += 1;
    }
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const total = acc.count || 1;
    return {
      ...acc, p95,
      avgMs: Math.round(acc.totalMs / total),
      browserPct: pct(acc.browser, total),
      cdnPct: pct(acc.cdn, total),
      blobPct: pct(acc.blob, total),
      supabasePct: pct(acc.supabase, total),
      supabaseAvoided: acc.browser + acc.cdn + acc.blob,
    };
  }, [metrics24h]);

  // Today vs yesterday
  const egressSummary = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const today = metrics24h.filter((m) => now - new Date(m.created_at).getTime() < dayMs);
    const supabaseToday = today.filter((m) => m.source === "supabase").length;
    const avoidedToday = today.length - supabaseToday;
    const bytesSaved = estimateBytesSaved(avoidedToday);
    return {
      today: today.length,
      supabaseToday,
      avoidedToday,
      bytesSaved,
      costSaved: estimateCostSaved(bytesSaved),
    };
  }, [metrics24h]);

  // Timeline (last 24h, bucketed hourly)
  const timeline = useMemo(() => {
    const now = Date.now();
    const buckets: Record<number, any> = {};
    for (let i = 23; i >= 0; i--) {
      const b = new Date(now - i * 60 * 60 * 1000);
      b.setMinutes(0, 0, 0);
      buckets[b.getTime()] = {
        time: `${b.getHours()}:00`, ts: b.getTime(),
        browser: 0, cdn: 0, blob: 0, supabase: 0,
      };
    }
    for (const m of metrics24h) {
      const d = new Date(m.created_at);
      d.setMinutes(0, 0, 0);
      const b = buckets[d.getTime()];
      if (b) b[m.source] += 1;
    }
    return Object.values(buckets);
  }, [metrics24h]);

  // Per-minute performance (last 60 minutes)
  const perfPerMin = useMemo(() => {
    const now = Date.now();
    const buckets: Record<number, any> = {};
    for (let i = 59; i >= 0; i--) {
      const b = Math.floor((now - i * 60_000) / 60_000) * 60_000;
      buckets[b] = { t: new Date(b).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), req: 0, ms: 0, n: 0 };
    }
    for (const m of metrics24h) {
      const b = Math.floor(new Date(m.created_at).getTime() / 60_000) * 60_000;
      if (buckets[b]) { buckets[b].req += 1; buckets[b].ms += m.ms || 0; buckets[b].n += 1; }
    }
    return Object.values(buckets).map((b: any) => ({ ...b, avgMs: b.n ? Math.round(b.ms / b.n) : 0 }));
  }, [metrics24h]);

  // Top violating paths
  const violations = useMemo(() => {
    const map = new Map<string, { path: string; count: number; totalMs: number; last: string }>();
    for (const m of metrics24h) {
      if (m.source !== "supabase") continue;
      const cur = map.get(m.path) || { path: m.path, count: 0, totalMs: 0, last: m.created_at };
      cur.count += 1; cur.totalMs += m.ms || 0;
      if (new Date(m.created_at) > new Date(cur.last)) cur.last = m.created_at;
      map.set(m.path, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 20);
  }, [metrics24h]);

  // Coverage
  const coverage = useMemo(() => {
    const rows = [
      { key: "products", label: "Products", icon: Boxes, db: dbCounts.products || 0, blob: byPrefix.products || 0 },
      { key: "services", label: "Services", icon: Layers, db: dbCounts.services || 0, blob: byPrefix.services || 0 },
      { key: "articles", label: "Articles", icon: Newspaper, db: dbCounts.insight_articles || 0, blob: byPrefix.articles || 0 },
      { key: "reels", label: "Reels", icon: Video, db: dbCounts.reels || 0, blob: byPrefix.reels || 0 },
      { key: "categories", label: "Categories", icon: Tag, db: dbCounts.categories || 0, blob: byPrefix.categories || 0 },
    ];
    return rows.map((r) => ({
      ...r,
      pct: r.db ? Math.min(100, (r.blob / r.db) * 100) : (r.blob ? 100 : 0),
    }));
  }, [dbCounts, byPrefix]);

  // Manifest diff
  const manifestDiff = useMemo(() => {
    if (!prevManifest || !manifest) return { added: [] as string[], changed: [] as string[], removed: [] as string[] };
    const prev = prevManifest.entities || {}, curr = manifest.entities || {};
    const added = Object.keys(curr).filter((k) => !(k in prev));
    const removed = Object.keys(prev).filter((k) => !(k in curr));
    const changed = Object.keys(curr).filter((k) => k in prev && prev[k] !== curr[k]);
    return { added, changed, removed };
  }, [manifest, prevManifest]);

  // Recommendations engine
  const recommendations = useMemo(() => {
    const recs: { severity: "high" | "medium" | "low" | "info"; title: string; detail: string; }[] = [];
    if (!STATIC_CDN.base) {
      recs.push({ severity: "high", title: "CDN base URL not configured",
        detail: "Set VITE_STATIC_CDN_BASE to your Vercel Blob public URL." });
    }
    if (trafficAgg.supabasePct > 5) {
      recs.push({ severity: "high", title: "Supabase serving too much static traffic",
        detail: `${trafficAgg.supabasePct.toFixed(1)}% of requests fall back to Supabase. Run Warm Smart, then investigate top violators.` });
    } else if (trafficAgg.supabasePct > 1) {
      recs.push({ severity: "medium", title: "Small Supabase fallback observed",
        detail: `${trafficAgg.supabase} requests fell through. Regenerate the entities in the Violations tab.` });
    }
    coverage.forEach((c) => {
      if (c.db > 0 && c.pct < 80) {
        recs.push({ severity: "medium", title: `${c.label} coverage low (${c.pct.toFixed(0)}%)`,
          detail: `Only ${c.blob} of ${c.db} ${c.label.toLowerCase()} have static JSON. Generate ${c.label.toLowerCase()}.` });
      }
    });
    if (trafficAgg.browserPct >= 80) {
      recs.push({ severity: "info", title: "Excellent browser cache utilization",
        detail: `${trafficAgg.browserPct.toFixed(0)}% served from IndexedDB — no network round trip.` });
    }
    if (failCount > 5) {
      recs.push({ severity: "high", title: "Static generation failures",
        detail: `${failCount} failed jobs in the last 200. Check the Logs tab.` });
    }
    if (trafficAgg.p95 > 500) {
      recs.push({ severity: "medium", title: "High P95 latency",
        detail: `95th percentile is ${trafficAgg.p95}ms. Consider warming CDN more often.` });
    }
    if (recs.length === 0) recs.push({ severity: "info", title: "All systems nominal", detail: "No optimizations required." });
    return recs;
  }, [trafficAgg, coverage, failCount]);

  // Health
  const cdnHealth = !STATIC_CDN.base ? "error" : totalFiles > 0 ? "healthy" : "warning";
  const manifestHealth = manifest ? "healthy" : STATIC_CDN.base ? "warning" : "error";
  const generatorHealth = failCount > 5 ? "error" : lastFail && (!lastOk || new Date(lastFail.created_at) > new Date(lastOk.created_at))
    ? "warning" : lastOk ? "healthy" : "unknown";
  const guardHealth = trafficAgg.supabasePct > 20 ? "error" : trafficAgg.supabasePct > 5 ? "warning" : "healthy";
  const blobHealth = STATIC_CDN.base ? (blobFiles.length ? "healthy" : "warning") : "error";
  const browserHealth = (storageInfo?.usage || 0) > 0 ? "healthy" : "unknown";

  // Exports
  const exportReport = (fmt: "json" | "csv") => {
    const rows = metrics24h.map((m) => ({
      time: m.created_at, path: m.path, source: m.source, ms: m.ms, status: m.status, violation: m.violation,
    }));
    let blob: Blob, name: string;
    if (fmt === "json") {
      blob = new Blob([JSON.stringify({
        generated_at: new Date().toISOString(),
        summary: { ...trafficAgg, egress: egressSummary, coverage, violations: violations.slice(0, 10) },
        rows,
      }, null, 2)], { type: "application/json" });
      name = `p4no-cache-report-${Date.now()}.json`;
    } else {
      const header = "time,path,source,ms,status,violation\n";
      const body = rows.map((r) => `${r.time},${r.path},${r.source},${r.ms},${r.status},${r.violation}`).join("\n");
      blob = new Blob([header + body], { type: "text/csv" });
      name = `p4no-cache-report-${Date.now()}.csv`;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  };

  const busyBtn = (label: string) => busy === label;
  const ActionBtn = ({ label, onClick, icon: Icon, variant = "outline" as any }: any) => (
    <Button size="sm" variant={variant} disabled={!!busy} onClick={onClick} className="justify-start">
      {busyBtn(label) ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : Icon && <Icon className="h-3.5 w-3.5 mr-2" />}
      {label}
    </Button>
  );

  const pieData = [
    { name: "Browser", value: trafficAgg.browser, key: "browser" },
    { name: "CDN", value: trafficAgg.cdn, key: "cdn" },
    { name: "Blob", value: trafficAgg.blob, key: "blob" },
    { name: "Supabase", value: trafficAgg.supabase, key: "supabase" },
  ].filter((d) => d.value > 0);

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            Cache Monitor
            <Badge variant="secondary" className="text-[10px] font-normal">Enterprise</Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Supabase → Static Generator → Vercel Blob → CDN → Browser (IndexedDB)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => exportReport("csv")}>
            <FileDown className="h-3.5 w-3.5 mr-1.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportReport("json")}>
            <FileDown className="h-3.5 w-3.5 mr-1.5" /> JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => { loadManifest(); loadLogs(); loadMetrics(); loadDbCounts(); }}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${(manifestLoading || logsLoading) ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => warm("smart")} disabled={!!busy}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Warm Smart
          </Button>
        </div>
      </div>

      {/* Executive Overview */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5" /> Executive Overview · Last 24h
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="DB Reads Prevented" value={egressSummary.avoidedToday.toLocaleString()}
            icon={Shield} tone="good" hint="served from cache" />
          <Stat label="Est. Egress Saved" value={fmtBytes(egressSummary.bytesSaved)}
            icon={TrendingDown} tone="good" hint="approx" />
          <Stat label="Est. Cost Saved" value={`$${egressSummary.costSaved.toFixed(4)}`}
            icon={DollarSign} tone="good" hint="@ $0.09/GB" />
          <Stat label="Supabase Reads" value={egressSummary.supabaseToday.toLocaleString()}
            icon={Database} tone={egressSummary.supabaseToday > 50 ? "warn" : "good"}
            hint={`${trafficAgg.supabasePct.toFixed(1)}% of traffic`} />
          <Stat label="Avg Latency" value={`${trafficAgg.avgMs}ms`} icon={Clock} tone="primary" />
          <Stat label="P95 Latency" value={`${trafficAgg.p95}ms`} icon={Activity}
            tone={trafficAgg.p95 > 500 ? "warn" : "good"} />
          <Stat label="Static Files" value={totalFiles.toLocaleString()} icon={FileJson}
            hint={`v${manifest?.version ?? "—"}`} />
          <Stat label="Blob Storage" value={fmtBytes(totalSize)} icon={HardDrive}
            hint={`${blobFiles.length} files probed`} />
        </div>
      </div>

      {/* Health strip */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" /> System Health
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div><div className="text-xs text-muted-foreground mb-1">Blob Storage</div>
            <HealthDot status={blobHealth as any} reason={blobFiles.length ? `${blobFiles.length} files` : "empty"} /></div>
          <div><div className="text-xs text-muted-foreground mb-1">Vercel CDN</div>
            <HealthDot status={cdnHealth as any} reason={STATIC_CDN.base ? "reachable" : "not configured"} /></div>
          <div><div className="text-xs text-muted-foreground mb-1">Manifest</div>
            <HealthDot status={manifestHealth as any} reason={manifest ? `v${manifest.version}` : "missing"} /></div>
          <div><div className="text-xs text-muted-foreground mb-1">Generator</div>
            <HealthDot status={generatorHealth as any} reason={`${successRate.toFixed(0)}% success`} /></div>
          <div><div className="text-xs text-muted-foreground mb-1">Browser Cache</div>
            <HealthDot status={browserHealth as any} reason={storageInfo ? fmtBytes(storageInfo.usage) : "—"} /></div>
          <div><div className="text-xs text-muted-foreground mb-1">Traffic Guard</div>
            <HealthDot status={guardHealth as any} reason={`${trafficAgg.violations} violations`} /></div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="traffic">
        <TabsList className="w-full flex-wrap h-auto gap-1 justify-start">
          <TabsTrigger value="traffic"><Globe className="h-3.5 w-3.5 mr-1" />Traffic</TabsTrigger>
          <TabsTrigger value="performance"><Activity className="h-3.5 w-3.5 mr-1" />Performance</TabsTrigger>
          <TabsTrigger value="coverage"><FileJson className="h-3.5 w-3.5 mr-1" />Coverage</TabsTrigger>
          <TabsTrigger value="violations"><AlertTriangle className="h-3.5 w-3.5 mr-1" />Violations</TabsTrigger>
          <TabsTrigger value="recommendations"><Sparkles className="h-3.5 w-3.5 mr-1" />Insights</TabsTrigger>
          <TabsTrigger value="generator">Generator</TabsTrigger>
          <TabsTrigger value="blob">Blob</TabsTrigger>
          <TabsTrigger value="browser">Browser</TabsTrigger>
          <TabsTrigger value="manifest">Manifest</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="infra"><Server className="h-3.5 w-3.5 mr-1" />Infrastructure Audit</TabsTrigger>
          <TabsTrigger value="sblogs"><Database className="h-3.5 w-3.5 mr-1" />Supabase Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="infra" className="mt-4">
          <InfrastructureAudit />
        </TabsContent>
        <TabsContent value="sblogs" className="mt-4">
          <SupabaseLogsPanel />
        </TabsContent>

        {/* --- Traffic --- */}
        <TabsContent value="traffic" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Traffic Sources (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {pieData.map((d) => <Cell key={d.key} fill={SOURCE_COLORS[d.key]} />)}
                      </Pie>
                      <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  {pieData.map((d) => (
                    <div key={d.key} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SOURCE_COLORS[d.key] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-medium">{pct(d.value, trafficAgg.count).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Traffic Timeline (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline}>
                      <defs>
                        {Object.entries(SOURCE_COLORS).map(([k, c]) => (
                          <linearGradient key={k} id={`g-${k}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={c} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={c} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="browser" stackId="1" stroke={SOURCE_COLORS.browser} fill="url(#g-browser)" />
                      <Area type="monotone" dataKey="cdn" stackId="1" stroke={SOURCE_COLORS.cdn} fill="url(#g-cdn)" />
                      <Area type="monotone" dataKey="blob" stackId="1" stroke={SOURCE_COLORS.blob} fill="url(#g-blob)" />
                      <Area type="monotone" dataKey="supabase" stackId="1" stroke={SOURCE_COLORS.supabase} fill="url(#g-supabase)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Browser" value={`${trafficAgg.browserPct.toFixed(1)}%`}
              icon={HardDrive} tone="good" hint={`${trafficAgg.browser} req · target ≥ 80%`} />
            <Stat label="CDN" value={`${trafficAgg.cdnPct.toFixed(1)}%`}
              icon={Wifi} tone="good" hint={`${trafficAgg.cdn} req · target ≥ 19%`} />
            <Stat label="Blob (self-heal)" value={`${trafficAgg.blobPct.toFixed(1)}%`}
              icon={Cloud} hint={`${trafficAgg.blob} req · target ≤ 1%`} />
            <Stat label="Supabase (fallback)" value={`${trafficAgg.supabasePct.toFixed(1)}%`}
              icon={Database} tone={trafficAgg.supabasePct > 5 ? "bad" : trafficAgg.supabasePct > 0.5 ? "warn" : "good"}
              hint={`${trafficAgg.supabase} req · target ≤ 0.5%`} />
          </div>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Live Request Inspector</CardTitle>
              <Badge variant="secondary" className="text-[10px]">{metrics.length} recent</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs sticky top-0">
                    <tr>
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">Path</th>
                      <th className="text-left p-2">Source</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.slice(0, 100).map((m) => (
                      <tr key={m.id} className={`border-t ${m.violation ? "bg-amber-500/5" : ""}`}>
                        <td className="p-2 whitespace-nowrap text-xs">{relTime(m.created_at)}</td>
                        <td className="p-2 font-mono text-[11px] max-w-[240px] truncate">{m.path}</td>
                        <td className="p-2">
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded"
                            style={{ background: `${SOURCE_COLORS[m.source]}20`, color: SOURCE_COLORS[m.source] }}>
                            {m.source}
                          </span>
                        </td>
                        <td className="p-2 text-xs">{m.status ?? "—"}</td>
                        <td className="p-2 text-xs tabular-nums">{m.ms ?? 0}ms</td>
                      </tr>
                    ))}
                    {metrics.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                        No traffic recorded yet. Browse the site to populate metrics.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Performance --- */}
        <TabsContent value="performance" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Requests per Minute (60m)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={perfPerMin}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="req" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Average Latency per Minute</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={perfPerMin}>
                    <defs><linearGradient id="g-ms" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="hsl(199 89% 48%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(199 89% 48%)" stopOpacity={0} />
                    </linearGradient></defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="avgMs" stroke="hsl(199 89% 48%)" fill="url(#g-ms)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Avg response" value={`${trafficAgg.avgMs}ms`} icon={Clock} />
            <Stat label="P95 latency" value={`${trafficAgg.p95}ms`} icon={Activity} tone={trafficAgg.p95 > 500 ? "warn" : "good"} />
            <Stat label="Max latency" value={`${trafficAgg.maxMs}ms`} icon={Gauge} />
            <Stat label="Total (24h)" value={trafficAgg.count.toLocaleString()} icon={Activity} />
          </div>
        </TabsContent>

        {/* --- Coverage --- */}
        <TabsContent value="coverage" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Static JSON Coverage</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {coverage.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <c.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{c.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{c.blob} <span className="opacity-60">/ {c.db}</span> in Blob</span>
                      <span className={`font-medium ${c.pct >= 95 ? "text-emerald-600" : c.pct >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {c.pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <Progress value={c.pct} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Special Feeds</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["homepage", "featured", "latest", "trending", "popular", "search"].map((k) => {
                  const has = Object.keys(entities).some((p) => p.includes(k));
                  return (
                    <div key={k} className="flex items-center gap-2 p-2 rounded border">
                      {has ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                      <span className="text-sm capitalize">{k}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Violations --- */}
        <TabsContent value="violations" className="mt-4 space-y-4">
          {violations.length === 0 ? (
            <Card className="border-emerald-500/40 bg-emerald-500/5">
              <CardContent className="p-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <div className="font-medium">No architecture violations</div>
                <div className="text-xs text-muted-foreground mt-1">All static traffic served by CDN or Browser Cache.</div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top Violating Paths (24h)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs">
                      <tr>
                        <th className="text-left p-2">Path</th>
                        <th className="text-left p-2">Hits</th>
                        <th className="text-left p-2">Avg ms</th>
                        <th className="text-left p-2">Last</th>
                        <th className="text-left p-2">Severity</th>
                        <th className="text-left p-2">Fix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {violations.map((v) => {
                        const sev = v.count > 50 ? "high" : v.count > 10 ? "medium" : "low";
                        return (
                          <tr key={v.path} className="border-t">
                            <td className="p-2 font-mono text-[11px]">{v.path}</td>
                            <td className="p-2 tabular-nums">{v.count}</td>
                            <td className="p-2 tabular-nums text-xs">{Math.round(v.totalMs / v.count)}ms</td>
                            <td className="p-2 text-xs">{relTime(v.last)}</td>
                            <td className="p-2">
                              <Badge variant={sev === "high" ? "destructive" : "secondary"} className="text-[10px]">
                                {sev}
                              </Badge>
                            </td>
                            <td className="p-2">
                              <Button size="sm" variant="ghost" className="h-6 text-xs"
                                onClick={() => {
                                  const entity = v.path.split("/")[0].replace(/s$/, "");
                                  generate((entity as EntityKind) || "all");
                                }}>
                                Regenerate
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* --- Recommendations --- */}
        <TabsContent value="recommendations" className="mt-4 space-y-3">
          {recommendations.map((r, i) => {
            const tone = r.severity === "high" ? "border-red-500/40 bg-red-500/5"
              : r.severity === "medium" ? "border-amber-500/40 bg-amber-500/5"
              : r.severity === "low" ? "border-blue-500/40 bg-blue-500/5"
              : "border-emerald-500/40 bg-emerald-500/5";
            const Icon = r.severity === "high" ? XCircle
              : r.severity === "medium" ? AlertTriangle
              : r.severity === "info" ? CheckCircle2 : Activity;
            return (
              <Card key={i} className={tone}>
                <CardContent className="p-4 flex items-start gap-3">
                  <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{r.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.detail}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">{r.severity}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* --- Generator --- */}
        <TabsContent value="generator" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Files generated (200)" value={totalGenerated} icon={FileJson} />
            <Stat label="Success rate" value={`${successRate.toFixed(1)}%`} icon={CheckCircle2}
              tone={successRate > 95 ? "good" : "warn"} />
            <Stat label="Successful" value={successCount} icon={CheckCircle2} tone="good" />
            <Stat label="Failed" value={failCount} icon={XCircle} tone={failCount ? "bad" : "default"} />
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Generation History</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(() => {
                    const buckets: Record<string, any> = {};
                    for (let i = 23; i >= 0; i--) {
                      const b = new Date(Date.now() - i * 60 * 60 * 1000);
                      b.setMinutes(0, 0, 0);
                      buckets[b.getTime()] = { time: `${b.getHours()}:00`, ok: 0, fail: 0 };
                    }
                    for (const l of logs) {
                      const d = new Date(l.created_at); d.setMinutes(0, 0, 0);
                      const b = buckets[d.getTime()];
                      if (b) l.ok ? b.ok++ : b.fail++;
                    }
                    return Object.values(buckets);
                  })()}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="ok" stackId="a" fill="hsl(142 71% 45%)" />
                    <Bar dataKey="fail" stackId="a" fill="hsl(0 84% 60%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Blob --- */}
        <TabsContent value="blob" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Files" value={blobFiles.length} icon={FileJson} />
            <Stat label="Total size" value={fmtBytes(totalSize)} icon={HardDrive} />
            <Stat label="Avg size" value={fmtBytes(avgFileSize)} icon={Layers} />
            <Stat label="Largest" value={fmtBytes(largestFile?.size)} icon={TrendingUp}
              hint={largestFile?.path} />
          </div>
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Blob Files</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => loadBlobFiles(manifest)}>
                <RefreshCw className={`h-3.5 w-3.5 ${blobLoading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs sticky top-0">
                    <tr>
                      <th className="text-left p-2">Path</th>
                      <th className="text-left p-2">Version</th>
                      <th className="text-left p-2">Size</th>
                      <th className="text-left p-2">Updated</th>
                      <th className="text-left p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blobFiles.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                        {STATIC_CDN.base ? "No files yet. Run Warm Everything." : "STATIC_CDN base not configured."}
                      </td></tr>
                    )}
                    {blobFiles.sort((a, b) => (b.size || 0) - (a.size || 0)).map((f) => (
                      <tr key={f.path} className="border-t">
                        <td className="p-2 font-mono text-xs">{f.path}.json</td>
                        <td className="p-2 text-xs">{f.version}</td>
                        <td className="p-2 text-xs">{fmtBytes(f.size)}</td>
                        <td className="p-2 text-xs">{fmtTime(f.updatedAt)}</td>
                        <td className="p-2">
                          <Button size="sm" variant="ghost" asChild>
                            <a href={f.url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /></a>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Browser Cache --- */}
        <TabsContent value="browser" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="IndexedDB used" value={fmtBytes(storageInfo?.usage)} icon={HardDrive} tone="primary" />
            <Stat label="Quota" value={fmtBytes(storageInfo?.quota)} icon={Database} />
            <Stat label="Hit rate" value={`${trafficAgg.browserPct.toFixed(1)}%`} icon={Zap}
              tone={trafficAgg.browserPct >= 80 ? "good" : "warn"} />
            <Stat label="Offline ready" value={totalFiles > 0 ? "Yes" : "No"} icon={Wifi}
              tone={totalFiles > 0 ? "good" : "warn"} />
          </div>
          {storageInfo && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Storage Usage</CardTitle></CardHeader>
              <CardContent>
                <Progress value={pct(storageInfo.usage, storageInfo.quota)} className="h-3" />
                <div className="text-xs text-muted-foreground mt-2">
                  {fmtBytes(storageInfo.usage)} of {fmtBytes(storageInfo.quota)} ({pct(storageInfo.usage, storageInfo.quota).toFixed(2)}%)
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* --- Manifest --- */}
        <TabsContent value="manifest" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Current version" value={manifest?.version ?? "—"} icon={Layers} />
            <Stat label="Previous version" value={prevManifest?.version ?? "—"} icon={Clock} />
            <Stat label="Entries" value={totalFiles} icon={FileJson} />
            <Stat label="Manifest size" value={fmtBytes(new Blob([JSON.stringify(manifest ?? {})]).size)} icon={HardDrive} />
          </div>
          {(manifestDiff.added.length + manifestDiff.changed.length + manifestDiff.removed.length) > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Manifest Diff</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-xs">
                <div><div className="text-emerald-600 font-medium mb-1">Added ({manifestDiff.added.length})</div>
                  <div className="space-y-0.5 max-h-40 overflow-auto font-mono text-[10px]">
                    {manifestDiff.added.slice(0, 20).map((p) => <div key={p}>+ {p}</div>)}
                  </div></div>
                <div><div className="text-amber-600 font-medium mb-1">Changed ({manifestDiff.changed.length})</div>
                  <div className="space-y-0.5 max-h-40 overflow-auto font-mono text-[10px]">
                    {manifestDiff.changed.slice(0, 20).map((p) => <div key={p}>~ {p}</div>)}
                  </div></div>
                <div><div className="text-red-600 font-medium mb-1">Removed ({manifestDiff.removed.length})</div>
                  <div className="space-y-0.5 max-h-40 overflow-auto font-mono text-[10px]">
                    {manifestDiff.removed.slice(0, 20).map((p) => <div key={p}>- {p}</div>)}
                  </div></div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Raw manifest</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-2">
                Base: <span className="font-mono">{STATIC_CDN.base || "not set"}</span>
              </div>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-[400px]">
{JSON.stringify(manifest ?? {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Controls --- */}
        <TabsContent value="controls" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Generate</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <ActionBtn label="Generate all" icon={Play} variant="default" onClick={() => generate("all")} />
              <ActionBtn label="Generate product" icon={Boxes} onClick={() => generate("product")} />
              <ActionBtn label="Generate service" icon={Layers} onClick={() => generate("service")} />
              <ActionBtn label="Generate reel" icon={Video} onClick={() => generate("reel")} />
              <ActionBtn label="Generate article" icon={Newspaper} onClick={() => generate("article")} />
              <ActionBtn label="Generate category" icon={Tag} onClick={() => generate("category")} />
              <ActionBtn label="Generate search" icon={SearchIcon} onClick={() => generate("product")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Warm CDN</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <ActionBtn label="Warm all" icon={Zap} variant="default" onClick={() => warm("all")} />
              <ActionBtn label="Warm smart" icon={Sparkles} onClick={() => warm("smart")} />
              <ActionBtn label="Warm products" icon={Boxes} onClick={() => warm("product")} />
              <ActionBtn label="Warm services" icon={Layers} onClick={() => warm("service")} />
              <ActionBtn label="Warm reels" icon={Video} onClick={() => warm("reel")} />
              <ActionBtn label="Warm articles" icon={Newspaper} onClick={() => warm("article")} />
              <ActionBtn label="Warm categories" icon={Tag} onClick={() => warm("category")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Invalidate</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <ActionBtn label="Invalidate all" icon={RefreshCw} variant="destructive" onClick={() => invalidate("all")} />
              <ActionBtn label="Invalidate products" icon={Boxes} onClick={() => invalidate("product")} />
              <ActionBtn label="Invalidate services" icon={Layers} onClick={() => invalidate("service")} />
              <ActionBtn label="Invalidate reels" icon={Video} onClick={() => invalidate("reel")} />
              <ActionBtn label="Invalidate articles" icon={Newspaper} onClick={() => invalidate("article")} />
              <ActionBtn label="Invalidate categories" icon={Tag} onClick={() => invalidate("category")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Self-heal & Hygiene</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <ActionBtn label="Validate integrity" icon={Shield} onClick={() => runIntegrity(false)} />
              <ActionBtn label="Generate missing files" icon={Play} variant="default" onClick={() => runIntegrity(true)} />
              <ActionBtn label="Rebuild manifest" icon={RefreshCw} onClick={runRebuildManifest} />
              <ActionBtn label="Clean old blobs (dry)" icon={FileJson} onClick={() => runCleanup(true)} />
              <ActionBtn label="Clean old blobs" icon={FileJson} variant="destructive" onClick={() => runCleanup(false)} />
              <ActionBtn label="Run health check" icon={Zap} onClick={runHealth} />
              <ActionBtn label="Consistency check" icon={Shield} onClick={runConsistency} />
              <ActionBtn label="Repair IndexedDB" icon={Database} variant="destructive" onClick={runRepairIDB} />
              <ActionBtn
                label={strict ? "Disable strict mode" : "Enable strict mode"}
                icon={Shield}
                variant={strict ? "destructive" : "default"}
                onClick={toggleStrict}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Logs --- */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Generation Logs (last 200)</CardTitle>
              <Button size="sm" variant="ghost" onClick={loadLogs}>
                <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs sticky top-0">
                    <tr>
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">Entity</th>
                      <th className="text-left p-2">Target</th>
                      <th className="text-left p-2">Files</th>
                      <th className="text-left p-2">Version</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No logs yet.</td></tr>
                    )}
                    {logs.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2 whitespace-nowrap text-xs">{relTime(l.created_at)}</td>
                        <td className="p-2"><Badge variant="secondary">{l.entity}</Badge></td>
                        <td className="p-2 text-xs text-muted-foreground">{l.slug || l.category || "—"}</td>
                        <td className="p-2 tabular-nums">{l.paths?.length ?? 0}</td>
                        <td className="p-2 text-xs">{l.version ?? "—"}</td>
                        <td className="p-2">
                          {l.ok
                            ? <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">OK</Badge>
                            : <Badge variant="destructive" title={l.error || ""}>Failed</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground pt-4 border-t">
        Last success: {lastOk ? fmtTime(lastOk.created_at) : "—"} · Last failure: {lastFail ? fmtTime(lastFail.created_at) : "—"} ·
        Dashboard auto-refreshes every 15s
      </div>
    </div>
  );
}
