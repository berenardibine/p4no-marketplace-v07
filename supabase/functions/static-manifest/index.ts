// Proxies current manifest.json from Blob for admin health checks.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const BASE = (Deno.env.get("STATIC_CDN_BASE") ?? "").replace(/\/+$/, "");
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!BASE) return new Response(JSON.stringify({ ok: false, error: "STATIC_CDN_BASE not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const r = await fetch(`${BASE}/manifest.json`, { cache: "no-store" });
    if (!r.ok) return new Response(JSON.stringify({ ok: false, status: r.status, entities: {} }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await r.text();
    return new Response(body, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});