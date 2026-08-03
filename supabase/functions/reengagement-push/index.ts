// Re-engagement push — wakes up users inactive for 3+ days.
// Triggered daily by pg_cron at 10:00 UTC.
//
// Cadence per user (anti-spam):
//   day 3   → "We miss you" + trending product
//   day 7   → "What's new" + article
//   day 14  → "Come back" + opportunity teaser
//   day 30  → final ping, then stop
//
// Uses notification_logs to ensure no more than 1 reengagement push per user
// every 4 days.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { guardFeature } from '../_shared/featureGuard.ts';

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
        target_user_ids: [userId],
        type: 'reengagement',
        title, body, url, image,
      }),
    });
  } catch (e) { console.warn('push failed', e); }
}

function pickCopy(daysSince: number, product: any, article: any) {
  if (daysSince >= 30) {
    return {
      title: "We'd love to see you back",
      body: 'New products, opportunities and stories are waiting on P4NO.',
      url: '/',
      image: product?.image_url,
    };
  }
  if (daysSince >= 14) {
    return {
      title: 'New opportunities on P4NO',
      body: 'Buyers, sellers and articles are active this week. Take a look.',
      url: '/',
      image: product?.image_url,
    };
  }
  if (daysSince >= 7) {
    return {
      title: article ? `📰 ${article.title}` : 'Catch up on P4NO',
      body: article ? 'New article we think you\'ll like.' : 'Something new is happening — come check it out.',
      url: article ? `/insights/${article.slug}` : '/insights',
      image: undefined,
    };
  }
  // 3-6 days
  return {
    title: product ? `🔥 ${product.name}` : 'Trending right now on P4NO',
    body: 'Trending right now — tap to take a look.',
    url: product ? `/product/${product.slug}` : '/',
    image: product?.image_url,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  // Background Guard — no reads at all while the trending/engagement engine is off.
  const stop = await guardFeature('trending_engine', corsHeaders);
  if (stop) return stop;

  const now = Date.now();
  const threeDaysAgo = new Date(now - 3 * 24 * 3600 * 1000).toISOString();
  const fortyDaysAgo = new Date(now - 40 * 24 * 3600 * 1000).toISOString();
  const fourDaysAgo = new Date(now - 4 * 24 * 3600 * 1000).toISOString();

  // Inactive 3-40 days (skip ancient users to keep cost bounded)
  const { data: inactive } = await admin
    .from('user_interest_profiles')
    .select('user_id, last_active_at')
    .lt('last_active_at', threeDaysAgo)
    .gt('last_active_at', fortyDaysAgo)
    .limit(2000);

  if (!inactive?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Only users with active push subscription
  const userIds = inactive.map((u) => u.user_id);
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('user_id')
    .in('user_id', userIds)
    .eq('is_active', true);
  const subbed = new Set((subs || []).map((s) => s.user_id));

  // Skip users already pinged in last 4 days
  const { data: recent } = await admin
    .from('notification_logs')
    .select('user_id')
    .eq('notification_type', 'reengagement')
    .gte('created_at', fourDaysAgo)
    .in('user_id', userIds);
  const recentSet = new Set((recent || []).map((r) => r.user_id));

  // Content pickers
  const { data: products } = await admin
    .from('products').select('id, name, slug, image_url')
    .eq('is_active', true).order('views', { ascending: false }).limit(5);
  const { data: articles } = await admin
    .from('insight_articles').select('id, title, slug')
    .eq('status', 'published').order('view_count', { ascending: false }).limit(5);

  let sent = 0;
  for (const u of inactive) {
    if (!subbed.has(u.user_id)) continue;
    if (recentSet.has(u.user_id)) continue;

    const days = Math.floor((now - new Date(u.last_active_at).getTime()) / (24 * 3600 * 1000));
    const product = products?.[sent % (products?.length || 1)];
    const article = articles?.[sent % (articles?.length || 1)];
    const copy = pickCopy(days, product, article);

    await admin.from('notifications').insert({
      user_id: u.user_id,
      type: 'reengagement',
      title: copy.title,
      message: copy.body,
      action_url: copy.url,
      image_url: copy.image,
      priority: 'low',
    });
    await dispatchPush(u.user_id, copy.title, copy.body, copy.url, copy.image);
    sent++;

    if (sent >= 500) break; // daily cap to control FCM cost
  }

  return new Response(JSON.stringify({ ok: true, sent, inactive: inactive.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
