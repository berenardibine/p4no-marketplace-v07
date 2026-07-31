// static-queue-status — read-only queue lookup for the client's
// missing-file wait strategy. Given a static path (e.g. "product/abc"),
// returns whether it is currently queued/running so the browser knows
// to wait for the next manifest bump instead of falling back to DB.
//
// Never writes, never enqueues. Safe to call frequently.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function entityFromPath(path: string): { entity: string; key?: string } | null {
  const p = path.replace(/^\/+/, "").replace(/\.json$/, "");
  if (p.startsWith("product/")) return { entity: "product", key: p.slice("product/".length) };
  if (p.startsWith("service/")) return { entity: "service", key: p.slice("service/".length) };
  if (p.startsWith("article/")) return { entity: "article", key: p.slice("article/".length) };
  if (p.startsWith("shops/")) return { entity: "shop", key: p.slice("shops/".length) };
  if (p.startsWith("sellers/")) return { entity: "seller", key: p.slice("sellers/".length) };
  if (p.startsWith("reels/")) return { entity: "reel" };
  if (p.startsWith("feeds/")) return { entity: "feeds" };
  if (p.startsWith("categories/")) return { entity: "category" };
  if (p === "homepage") return { entity: "homepage" };
  if (p.startsWith("search/")) return { entity: "search" };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let path = url.searchParams.get("path") ?? "";
    if (!path && req.method !== "GET") {
      const body = await req.json().catch(() => null) as { path?: string } | null;
      path = body?.path ?? "";
    }
    if (!path) {
      return new Response(JSON.stringify({ ok: false, error: "path required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const target = entityFromPath(path);
    if (!target) {
      return new Response(JSON.stringify({ ok: true, queued: false, running: false, unknown: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = admin.from("generation_queue")
      .select("id,status,created_at", { count: "exact", head: false })
      .in("status", ["pending", "running"])
      .eq("entity_type", target.entity);
    if (target.key) query = query.eq("entity_id", target.key);

    const { data, error } = await query.limit(5);
    if (error) throw error;

    const running = (data ?? []).some((r) => r.status === "running");
    const queued = (data ?? []).some((r) => r.status === "pending");

    return new Response(
      JSON.stringify({ ok: true, queued, running, count: data?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});