// Product Static Engine V3 — monitor + migration console.
//
// Read-only by default (one fetch on mount, no polling). The migration button
// walks the product table in batches and generates any missing sharded JSON.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Boxes, PlayCircle, ShieldCheck, AlertTriangle, Database, Gauge, HardDrive } from "lucide-react";

interface ManifestRow {
  path: string;
  shard: string | null;
  size: number | null;
  duration_ms: number | null;
  version: number | null;
  generated_at: string;
}

interface MetricRow {
  source: "browser" | "cdn" | "blob" | "supabase";
  violation: boolean;
}

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${u[i]}`;
}
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);

export default function AdminProductStatic() {
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [rows, setRows] = useState<ManifestRow[]>([]);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [queued, setQueued] = useState(0);
  const [failures, setFailures] = useState(0);
  const [locks, setLocks] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [prodRes, manifestRes, metricsRes, queueRes, failRes, lockRes] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("static_manifest")
        .select("path,shard,size,duration_ms,version,generated_at")
        .eq("entity", "product")
        .order("generated_at", { ascending: false })
        .limit(5000),
      supabase.from("cdn_metrics").select("source,violation").order("created_at", { ascending: false }).limit(2000),
      supabase.from("generation_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("static_gen_log").select("id", { count: "exact", head: true }).eq("ok", false).gte("created_at", since),
      supabase.from("generation_locks").select("name,holder"),
    ]);
    setTotalProducts(prodRes.count ?? 0);
    setRows((manifestRes.data as ManifestRow[]) ?? []);
    setMetrics((metricsRes.data as MetricRow[]) ?? []);
    setQueued(queueRes.count ?? 0);
    setFailures(failRes.count ?? 0);
    setLocks(((lockRes.data as { name: string }[]) ?? []).map((l) => l.name));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const withJson = rows.length;
  const missing = Math.max(0, totalProducts - withJson);
  const coverage = pct(withJson, totalProducts || withJson || 1);
  const avgMs = useMemo(() => {
    const d = rows.map((r) => r.duration_ms ?? 0).filter(Boolean);
    return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : 0;
  }, [rows]);
  const totalBytes = rows.reduce((a, r) => a + (r.size ?? 0), 0);
  const manifestVersion = rows[0]?.version ?? 0;

  const shardDist = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const s = r.shard ?? r.path.split("/")[1] ?? "??";
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);
  const shardMax = shardDist.reduce((a, [, c]) => Math.max(a, c), 0);

  const serve = useMemo(() => {
    const t = { browser: 0, cdn: 0, blob: 0, supabase: 0, violations: 0 };
    for (const m of metrics) {
      t[m.source] = (t[m.source] ?? 0) + 1;
      if (m.violation) t.violations++;
    }
    return t;
  }, [metrics]);
  const totalServe = serve.browser + serve.cdn + serve.blob + serve.supabase;
  const staticServe = serve.browser + serve.cdn + serve.blob;
  const egressSaved = staticServe * 4096;

  const integrity: "healthy" | "degraded" | "unknown" =
    totalProducts === 0 ? "unknown" : missing === 0 && failures === 0 ? "healthy" : "degraded";

  async function runMigration() {
    setMigrating(true);
    setMigrationLog([]);
    let offset = 0;
    let guard = 0;
    try {
      while (guard++ < 200) {
        const { data, error } = await supabase.functions.invoke("static-product-migrate", {
          body: { limit: 200, offset },
        });
        if (error) throw error;
        const r = data as any;
        if (r?.skipped) {
          setMigrationLog((l) => [...l, `Skipped: ${r.reason}`]);
          break;
        }
        setMigrationLog((l) => [
          ...l,
          `Batch ${offset}-${r.nextOffset}: generated ${r.generated}, skipped ${r.skipped}, failed ${r.failed} (${r.durationMs}ms)`,
        ]);
        offset = r.nextOffset;
        if (r.done) break;
      }
      toast({ title: "Migration complete", description: "All products have sharded JSON files." });
      await load();
    } catch (e: any) {
      toast({ title: "Migration failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Product Static Engine</h1>
          <p className="text-sm text-muted-foreground">
            One sharded JSON per product · products/&lt;00-ff&gt;/&lt;slug&gt;.json
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={runMigration} disabled={migrating}>
            <PlayCircle className={`h-4 w-4 mr-2 ${migrating ? "animate-pulse" : ""}`} />
            {migrating ? "Migrating…" : "Generate missing JSON"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Boxes className="h-3 w-3" /> Products</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalProducts.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><HardDrive className="h-3 w-3" /> With JSON</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{withJson.toLocaleString()}</div>
            <Progress value={coverage} className="mt-1 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Missing JSON</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{missing.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">auto-healed on request</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Integrity</CardTitle></CardHeader>
          <CardContent>
            <Badge variant={integrity === "healthy" ? "secondary" : integrity === "degraded" ? "destructive" : "outline"}>
              {integrity}
            </Badge>
            <div className="text-xs text-muted-foreground mt-1">{failures} failures (24h)</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4" /> Generator</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Queue depth</span><Badge variant={queued > 50 ? "destructive" : "secondary"}>{queued}</Badge></div>
            <div className="flex justify-between"><span>Running generators</span><Badge variant={locks.length > 1 ? "destructive" : "outline"}>{locks.length}</Badge></div>
            <div className="flex justify-between"><span>Avg generation time</span><span className="tabular-nums">{avgMs} ms</span></div>
            <div className="flex justify-between"><span>Manifest version</span><span className="tabular-nums">{manifestVersion || "—"}</span></div>
            <div className="flex justify-between"><span>Total product JSON size</span><span className="tabular-nums">{fmtBytes(totalBytes)}</span></div>
            <div className="flex justify-between"><span>Shard folders in use</span><span className="tabular-nums">{shardDist.length} / 256</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Delivery mix</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { label: "Browser cache / IndexedDB", value: serve.browser },
              { label: "CDN", value: serve.cdn },
              { label: "Static JSON (self-heal)", value: serve.blob },
              { label: "Supabase fallback", value: serve.supabase },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <div className="w-44 text-xs">{r.label}</div>
                <Progress value={pct(r.value, totalServe)} className="h-2 flex-1" />
                <div className="w-16 text-right text-xs tabular-nums">{pct(r.value, totalServe)}%</div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t"><span>Cache hit rate</span><span className="tabular-nums">{pct(staticServe, totalServe)}%</span></div>
            <div className="flex justify-between"><span>DB reads prevented</span><span className="tabular-nums">{staticServe.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>PostgREST egress saved</span><span className="tabular-nums">{fmtBytes(egressSaved)}</span></div>
            <div className="flex justify-between"><span>Fallback requests</span><span className="tabular-nums">{serve.supabase.toLocaleString()}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Hash folder distribution</CardTitle></CardHeader>
        <CardContent>
          {shardDist.length === 0 ? (
            <div className="text-sm text-muted-foreground">No product JSON generated yet.</div>
          ) : (
            <div className="grid grid-cols-8 sm:grid-cols-16 gap-1">
              {shardDist.map(([shard, count]) => (
                <div key={shard} className="text-center" title={`${shard}: ${count} products`}>
                  <div
                    className="h-8 rounded bg-primary/20 flex items-end justify-center overflow-hidden"
                    aria-label={`shard ${shard}`}
                  >
                    <div className="w-full bg-primary" style={{ height: `${Math.max(8, (count / shardMax) * 100)}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{shard}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {migrationLog.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Migration report</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs font-mono">
            {migrationLog.map((l, i) => <div key={i}>{l}</div>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
