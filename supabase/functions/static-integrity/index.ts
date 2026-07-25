// Static integrity checker
// Walks the current manifest, HEADs every file on the CDN, and reports/repairs missing files.
// Body: { repair?: boolean }
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CDN = (Deno.env.get("STATIC_CDN_BASE") ?? "").replace(/\/+$/, "");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function entityFor(path: string): { entity: string; slug?: string; category?: string } | null {
  if (path.startsWith("product/")) return { entity: "product", slug: path.slice(8) };
  if (path.startsWith("service/")) return { entity: "service", slug: path.slice(8) };
  if (path.startsWith("article/")) return { entity: "article", slug: path.slice(8) };
  if (path.startsWith("products/category/")) return { entity: "category", category: path.slice(18) };
  if (path.startsWith("products/")) return { entity: "product" };
  if (path.startsWith("services/")) return { entity: "service" };
  if (path.startsWith("reels/")) return { entity: "reel" };
  if (path.startsWith("articles/")) return { entity: "article" };
  if (path.startsWith("categories/")) return { entity: "category" };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = Date.now();
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const repair = !!body?.repair;
    if (!CDN) throw new Error("STATIC_CDN_BASE not set");

    const mr = await fetch(`${CDN}/manifest.json`, { cache: "no-store" });
    if (!mr.ok) throw new Error(`manifest fetch ${mr.status}`);
    const manifest = await mr.json();
    const entities: Record<string, number> = manifest.entities ?? {};
    const paths = Object.keys(entities);

    const missing: string[] = [];
    // Batched HEADs (10 at a time)
    for (let i = 0; i < paths.length; i += 10) {
      const chunk = paths.slice(i, i + 10);
      const results = await Promise.all(
        chunk.map(async (p) => {
          try {
            const r = await fetch(`${CDN}/${p}.json`, { method: "HEAD" });
            return { p, ok: r.ok };
          } catch { return { p, ok: false }; }
        }),
      );
      for (const r of results) if (!r.ok) missing.push(r.p);
    }

    const repaired: string[] = [];
    if (repair && missing.length > 0) {
      // Group by entity kind so we don't over-generate
      const groups = new Set<string>();
      for (const p of missing) {
        const e = entityFor(p);
        if (!e) continue;
        const key = JSON.stringify(e);
        if (groups.has(key)) continue;
        groups.add(key);
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/static-generate`, {
            method: "POST",
            headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
            body: JSON.stringify(e),
          });
          if (r.ok) repaired.push(p);
        } catch { /* ignore */ }
      }
    }

    await admin.from("static_gen_log").insert({
      entity: "integrity",
      paths: missing,
      version: manifest.version ?? 0,
      ok: true,
      error: repair ? `repaired ${repaired.length}/${missing.length}` : null,
    });

    return new Response(JSON.stringify({
      ok: true,
      duration_ms: Date.now() - started,
      total: paths.length,
      missing_count: missing.length,
      missing,
      repaired_count: repaired.length,
      repaired,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
