// Aggregate health snapshot for the Admin Cache Monitor.
// Returns cache hit distribution (24h), manifest coverage, recent gen log, blob totals.
import { list } from "npm:@vercel/blob@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BLOB_TOKEN = Deno.env.get("BLOB_READ_WRITE_TOKEN")!;
const CDN = (Deno.env.get("STATIC_CDN_BASE") ?? "").replace(/\/+$/, "");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [metricsRes, logsRes, manifestRes] = await Promise.all([
      admin.from("cdn_metrics").select("source,ms,violation,created_at").gte("created_at", since).limit(10000),
      admin.from("static_gen_log").select("*").order("created_at", { ascending: false }).limit(50),
      CDN ? fetch(`${CDN}/manifest.json`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
    ]);

    const metrics = metricsRes.data ?? [];
    const counters = { browser: 0, cdn: 0, blob: 0, supabase: 0, violations: 0, totalMs: 0, count: 0 };
    for (const m of metrics) {
      counters[m.source as keyof typeof counters] = (counters[m.source as keyof typeof counters] as number) + 1;
      if (m.violation) counters.violations += 1;
      counters.totalMs += m.ms || 0;
      counters.count += 1;
    }
    const total = counters.count || 1;
    const supabasePct = (counters.supabase / total) * 100;
    const cachePct = ((counters.browser + counters.cdn + counters.blob) / total) * 100;
    const violationsPct = (counters.violations / total) * 100;

    // Health score: 100 - supabasePct*2 - violationsPct*3, clamped.
    const healthScore = Math.max(0, Math.min(100, Math.round(100 - supabasePct * 2 - violationsPct * 3)));

    // Blob totals (best-effort)
    let blobFiles = 0, blobBytes = 0;
    try {
      let cursor: string | undefined = undefined;
      while (true) {
        const page: any = await list({ token: BLOB_TOKEN, cursor, limit: 1000 });
        for (const b of page.blobs ?? []) { blobFiles += 1; blobBytes += b.size || 0; }
        if (!page.hasMore) break;
        cursor = page.cursor;
        if (blobFiles > 5000) break;
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({
      ok: true,
      health_score: healthScore,
      window_hours: 24,
      requests: counters.count,
      distribution: {
        browser: counters.browser, cdn: counters.cdn, blob: counters.blob, supabase: counters.supabase,
        violations: counters.violations,
      },
      supabase_pct: supabasePct,
      cache_pct: cachePct,
      violations_pct: violationsPct,
      avg_latency_ms: Math.round(counters.totalMs / total),
      manifest: manifestRes ? { version: manifestRes.version, entries: Object.keys(manifestRes.entities ?? {}).length } : null,
      blob: { files: blobFiles, bytes: blobBytes },
      recent_logs: logsRes.data ?? [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
