import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekStart = monday.toISOString().split("T")[0];
    const weekEnd = sunday.toISOString().split("T")[0];

    // Previous week
    const prevMonday = new Date(monday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    prevSunday.setHours(23, 59, 59, 999);
    const prevWeekStart = prevMonday.toISOString().split("T")[0];

    // Get all approved products with sellers
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, seller_id")
      .eq("status", "approved");

    if (prodErr) throw prodErr;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ message: "No products to aggregate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productIds = products.map((p: any) => p.id);

    // Fetch current week views & impressions
    const [viewsRes, impressionsRes] = await Promise.all([
      supabase
        .from("product_views")
        .select("product_id")
        .in("product_id", productIds)
        .gte("created_at", monday.toISOString())
        .lte("created_at", sunday.toISOString()),
      supabase
        .from("product_impressions")
        .select("product_id")
        .in("product_id", productIds)
        .gte("created_at", monday.toISOString())
        .lte("created_at", sunday.toISOString()),
    ]);

    // Fetch lifetime from metrics cache
    const { data: metricsCache } = await supabase
      .from("product_metrics_cache")
      .select("product_id, total_views, total_impressions")
      .in("product_id", productIds);

    const metricMap = new Map(
      (metricsCache || []).map((m: any) => [m.product_id, m])
    );

    // Count current week per product
    const wViews = new Map<string, number>();
    const wImps = new Map<string, number>();
    (viewsRes.data || []).forEach((v: any) => {
      wViews.set(v.product_id, (wViews.get(v.product_id) || 0) + 1);
    });
    (impressionsRes.data || []).forEach((i: any) => {
      wImps.set(i.product_id, (wImps.get(i.product_id) || 0) + 1);
    });

    // Aggregate per seller
    const sellerMap = new Map<string, {
      weeklyViews: number; weeklyImpressions: number;
      lifetimeViews: number; lifetimeImpressions: number;
    }>();

    for (const p of products) {
      const sid = p.seller_id;
      const existing = sellerMap.get(sid) || { weeklyViews: 0, weeklyImpressions: 0, lifetimeViews: 0, lifetimeImpressions: 0 };
      existing.weeklyViews += wViews.get(p.id) || 0;
      existing.weeklyImpressions += wImps.get(p.id) || 0;
      const cached = metricMap.get(p.id);
      existing.lifetimeViews += cached?.total_views || 0;
      existing.lifetimeImpressions += cached?.total_impressions || 0;
      sellerMap.set(sid, existing);
    }

    // Fetch previous week reports for growth calculation
    const sellerIds = Array.from(sellerMap.keys());
    const { data: prevReports } = await supabase
      .from("seller_weekly_reports")
      .select("seller_id, weekly_views, weekly_impressions")
      .in("seller_id", sellerIds)
      .eq("week_start", prevWeekStart);

    const prevMap = new Map(
      (prevReports || []).map((r: any) => [r.seller_id, r])
    );

    // Generate suggestion
    function getSuggestion(wv: number, wi: number, gv: number): string {
      if (wv === 0 && wi === 0) return "Start sharing your products on social media to get your first views!";
      if (wi > 50 && wv < 5) return "Your products are being seen but not clicked. Try improving titles and images.";
      if (gv > 0) return "Great progress! Keep posting and sharing to maintain growth.";
      if (gv < 0) return "Views dropped this week. Try updating product photos and sharing on WhatsApp.";
      return "Share your products on social media to reach more buyers!";
    }

    // Calculate growth and upsert reports
    const reports = Array.from(sellerMap.entries()).map(([sellerId, stats]) => {
      const prev = prevMap.get(sellerId);
      const prevViews = prev?.weekly_views || 0;
      const prevImps = prev?.weekly_impressions || 0;

      const growthViews = prevViews === 0
        ? (stats.weeklyViews > 0 ? 100 : 0)
        : Math.round(((stats.weeklyViews - prevViews) / prevViews) * 100);
      const growthImps = prevImps === 0
        ? (stats.weeklyImpressions > 0 ? 100 : 0)
        : Math.round(((stats.weeklyImpressions - prevImps) / prevImps) * 100);

      return {
        seller_id: sellerId,
        week_start: weekStart,
        week_end: weekEnd,
        weekly_views: stats.weeklyViews,
        weekly_impressions: stats.weeklyImpressions,
        lifetime_views: stats.lifetimeViews,
        lifetime_impressions: stats.lifetimeImpressions,
        growth_views_pct: growthViews,
        growth_impressions_pct: growthImps,
        suggestion: getSuggestion(stats.weeklyViews, stats.weeklyImpressions, growthViews),
      };
    });

    // Batch upsert
    let processed = 0;
    const batchSize = 50;
    for (let i = 0; i < reports.length; i += batchSize) {
      const batch = reports.slice(i, i + batchSize);
      const { error: upsertErr } = await supabase
        .from("seller_weekly_reports")
        .upsert(batch, { onConflict: "seller_id,week_start" });
      if (upsertErr) console.error("Upsert error:", upsertErr);
      processed += batch.length;
    }

    // Also update product_weekly_stats for backward compat
    const productRows = products.map((p: any) => {
      const cached = metricMap.get(p.id);
      return {
        product_id: p.id,
        seller_id: p.seller_id,
        total_views: cached?.total_views || 0,
        total_impressions: cached?.total_impressions || 0,
        weekly_views: wViews.get(p.id) || 0,
        weekly_impressions: wImps.get(p.id) || 0,
        week_start: weekStart,
        week_end: weekEnd,
        updated_at: now.toISOString(),
      };
    });

    for (let i = 0; i < productRows.length; i += batchSize) {
      const batch = productRows.slice(i, i + batchSize);
      await supabase
        .from("product_weekly_stats")
        .upsert(batch, { onConflict: "product_id,week_start" });
    }

    // Send weekly notifications (on Sunday/Monday)
    let notificationsSent = 0;
    const isReportDay = dayOfWeek === 0 || dayOfWeek === 1;

    if (isReportDay) {
      const notifications = reports
        .filter(r => r.weekly_views > 0 || r.weekly_impressions > 0)
        .map(r => {
          const growthEmoji = r.growth_views_pct > 0 ? "📈" : r.growth_views_pct < 0 ? "📉" : "➡️";
          const growthText = r.growth_views_pct > 0 ? `+${r.growth_views_pct}%` : `${r.growth_views_pct}%`;
          return {
            user_id: r.seller_id,
            title: "📊 Weekly Performance Report",
            message: `🎉 This week: 👁 ${r.weekly_views} views • 📊 ${r.weekly_impressions} impressions • ${growthEmoji} ${growthText} growth\n\n💡 ${r.suggestion}`,
            type: "analytics",
            is_read: false,
          };
        });

      if (notifications.length > 0) {
        const { error: notifErr } = await supabase
          .from("notifications")
          .insert(notifications);
        if (notifErr) console.error("Notification error:", notifErr);
        notificationsSent = notifications.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, notificationsSent, weekStart, weekEnd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Aggregation error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
