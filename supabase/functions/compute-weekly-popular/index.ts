// Aggregates product activity into weekly_product_stats and pushes top list to Redis.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { guardFeature } from "../_shared/featureGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REDIS_URL = Deno.env.get("UPSTASH_REDIS_REST_URL") ?? "";
const REDIS_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

async function redisSet(key: string, value: unknown, ttl: number) {
  if (!REDIS_URL) return;
  await fetch(`${REDIS_URL}/setex/${encodeURIComponent(key)}/${ttl}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(value)),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Background Guard — Popular This Week is off: exit before any DB access.
  const stop = await guardFeature("popular_this_week", corsHeaders);
  if (stop) return stop;
  try {
    const { year, week } = isoWeek();
    const sinceIso = new Date(Date.now() - 7 * 86400000).toISOString();

    // Views in last 7d
    const { data: views } = await supabase
      .from("product_views")
      .select("product_id")
      .gte("created_at", sinceIso)
      .limit(50000);
    const viewMap = new Map<string, number>();
    (views ?? []).forEach((v: any) => {
      viewMap.set(v.product_id, (viewMap.get(v.product_id) ?? 0) + 1);
    });

    // Favorites in last 7d
    const { data: favs } = await supabase
      .from("product_likes")
      .select("product_id, created_at")
      .gte("created_at", sinceIso)
      .limit(50000);
    const favMap = new Map<string, number>();
    (favs ?? []).forEach((v: any) => {
      favMap.set(v.product_id, (favMap.get(v.product_id) ?? 0) + 1);
    });

    const ids = new Set<string>([...viewMap.keys(), ...favMap.keys()]);
    const rows = Array.from(ids).map((id) => {
      const v = viewMap.get(id) ?? 0;
      const f = favMap.get(id) ?? 0;
      const score = v * 1 + f * 5;
      return {
        product_id: id,
        year,
        week_number: week,
        views: v,
        clicks: 0,
        favorites: f,
        score,
        updated_at: new Date().toISOString(),
      };
    });

    if (rows.length > 0) {
      await supabase
        .from("weekly_product_stats")
        .upsert(rows, { onConflict: "product_id,year,week_number" });
    }

    // Top 20 product details for popular cache
    const topIds = rows
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => r.product_id);

    let payload: any[] = [];
    if (topIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select(
          `id, title, slug, price, images, category, location, status,
           created_at, views, likes, rental_unit, rental_fee, sponsored,
           product_type, country, currency_code, currency_symbol,
           is_negotiable, admin_posted, discount, discount_expiry,
           seller_id, shop_id,
           seller:profiles!products_seller_id_fkey(id, full_name, profile_image, whatsapp_number, call_number),
           shop:shops(id, name, logo_url, trading_center)`,
        )
        .in("id", topIds)
        .eq("status", "active");
      // preserve score order
      const orderMap = new Map(topIds.map((id, i) => [id, i]));
      payload = (products ?? []).sort(
        (a: any, b: any) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99),
      );
    }

    await redisSet("products:popular:this-week", payload, 3600);

    return new Response(
      JSON.stringify({ ok: true, year, week, products: payload.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
