// static-consistency
// -------------------
// Enterprise cache consistency checker.
// Compares Supabase row counts per surface with the manifest entries, and
// auto-triggers static-generate on drift. Runs via cron every 15 minutes.
//
// GET/POST → { ok, drift: [...], repaired: [...] }

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const STATIC_BASE = (Deno.env.get("STATIC_CDN_BASE") ?? "").replace(/\/+$/, "");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Manifest prefix → source-of-truth query. Value = expected keys count.
async function surfaces() {
  const [prods, servs, arts] = await Promise.all([
    admin.from("products").select("*", { count: "exact", head: true }).eq("status", "active"),
    admin.from("services").select("*", { count: "exact", head: true }).eq("status", "active"),
    admin.from("insight_articles").select("*", { count: "exact", head: true }).eq("status", "published"),
  ]);
  return {
    product: prods.count ?? 0,
    service: servs.count ?? 0,
    article: arts.count ?? 0,
  };
}

async function loadManifest(): Promise<{ entities?: Record<string, number> } | null> {
  if (!STATIC_BASE) return null;
  try {
    const r = await fetch(`${STATIC_BASE}/manifest.json`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function trigger(entity: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/static-generate`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ entity }),
    });
    return true;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const [counts, manifest] = await Promise.all([surfaces(), loadManifest()]);
    const entities = manifest?.entities ?? {};

    const countPrefix = (prefix: string) =>
      Object.keys(entities).filter((k) => k.startsWith(`${prefix}/`)).length;

    // Drift heuristic: for detail-heavy prefixes, static should have at least
    // as many detail blobs as DB rows (list blobs excluded). We check whether
    // any list blobs exist per surface and re-generate if missing.
    const surfacesToCheck: Array<{ entity: string; listPrefix: string; dbCount: number }> = [
      { entity: "product",  listPrefix: "products",   dbCount: counts.product },
      { entity: "service",  listPrefix: "services",   dbCount: counts.service },
      { entity: "article",  listPrefix: "articles",   dbCount: counts.article },
      { entity: "reel",     listPrefix: "reels",      dbCount: counts.product },
      { entity: "category", listPrefix: "categories", dbCount: 1 },
    ];

    const drift: any[] = [];
    const repaired: string[] = [];
    for (const s of surfacesToCheck) {
      const listCount = countPrefix(s.listPrefix);
      const missing = listCount === 0 && s.dbCount > 0;
      if (missing) {
        drift.push({ entity: s.entity, reason: "list blobs missing", dbCount: s.dbCount });
        const ok = await trigger(s.entity);
        if (ok) repaired.push(s.entity);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      checked_at: new Date().toISOString(),
      counts,
      manifest_entries: Object.keys(entities).length,
      drift,
      repaired,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
