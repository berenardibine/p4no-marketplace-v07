// Warm the CDN by triggering static-generate for one or more entities.
// POST body: { entity?: 'all' | 'product' | 'service' | 'reel' | 'article' | 'category' }
// Defaults to 'all' when omitted.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = Date.now();
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const entity = (body?.entity ?? "all").toString();
    const allowed = ["all", "smart", "product", "service", "reel", "article", "category"];
    if (!allowed.includes(entity)) {
      return new Response(JSON.stringify({ ok: false, error: `invalid entity: ${entity}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Smart mode: only regenerate the homepage-critical lists (fast + cheap).
    if (entity === "smart") {
      const results = await Promise.all(
        ["product", "category"].map(async (e) => {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/static-generate`, {
            method: "POST",
            headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
            body: JSON.stringify({ entity: e }),
          });
          return { entity: e, ok: r.ok, status: r.status };
        }),
      );
      return new Response(JSON.stringify({
        ok: true, entity: "smart", duration_ms: Date.now() - started, results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await fetch(`${SUPABASE_URL}/functions/v1/static-generate`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ entity }),
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    const duration_ms = Date.now() - started;
    return new Response(JSON.stringify({ ok: r.ok, entity, duration_ms, ...parsed }), {
      status: r.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
