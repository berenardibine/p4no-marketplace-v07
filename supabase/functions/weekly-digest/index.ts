// Weekly digest — buyer + seller summary notification.
// Triggered by pg_cron every Monday 09:00 UTC.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function dispatchPush(userId: string, title: string, body: string, url: string, image?: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({
        mode: 'admin',
        // direct user override
        target_user_ids: [userId],
        title, body, url, image,
      }),
    });
  } catch (e) { console.warn('push failed', e); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // 1. SELLER DIGESTS — anyone with seller_weekly_reports row this week
  const { data: reports } = await admin
    .from('seller_weekly_reports')
    .select('seller_id, weekly_views, weekly_impressions, growth_views_pct, week_start')
    .gte('week_start', weekStart.slice(0, 10));

  let sellerCount = 0;
  for (const r of reports || []) {
    const views = r.weekly_views || 0;
    const growth = Number(r.growth_views_pct || 0);
    const arrow = growth >= 0 ? '📈' : '📉';
    const title = 'Your weekly seller report';
    const body = `${arrow} ${views} views this week (${growth >= 0 ? '+' : ''}${growth.toFixed(0)}% vs last week). Tap to see your stats.`;
    await admin.from('notifications').insert({
      user_id: r.seller_id,
      type: 'weekly_digest',
      title, message: body,
      action_url: '/seller-dashboard',
      priority: 'medium',
    });
    await dispatchPush(r.seller_id, title, body, '/seller-dashboard');
    sellerCount++;
  }

  // 2. BUYER DIGEST — active users with no seller report
  const { data: buyers } = await admin
    .from('user_interest_profiles')
    .select('user_id, last_active_at')
    .gte('last_active_at', weekStart);

  const sellerIds = new Set((reports || []).map((r) => r.seller_id));

  // Trending products this week
  const { data: trending } = await admin
    .from('products')
    .select('id, name, slug, image_url, views')
    .eq('is_active', true)
    .order('views', { ascending: false })
    .limit(3);

  // Top article this week
  const { data: articles } = await admin
    .from('insight_articles')
    .select('id, title, slug')
    .eq('status', 'published')
    .order('view_count', { ascending: false })
    .limit(1);

  const topProduct = trending?.[0];
  const topArticle = articles?.[0];

  let buyerCount = 0;
  for (const b of buyers || []) {
    if (sellerIds.has(b.user_id)) continue;
    const parts: string[] = [];
    if (topProduct) parts.push(`🔥 ${topProduct.name}`);
    if (topArticle) parts.push(`📰 ${topArticle.title}`);
    if (!parts.length) continue;
    const title = 'Your P4NO weekly picks';
    const body = parts.join(' • ');
    await admin.from('notifications').insert({
      user_id: b.user_id,
      type: 'weekly_digest',
      title, message: body,
      action_url: '/',
      image_url: topProduct?.image_url,
      priority: 'low',
    });
    await dispatchPush(b.user_id, title, body, '/', topProduct?.image_url);
    buyerCount++;
  }

  return new Response(JSON.stringify({ ok: true, sellerCount, buyerCount }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
