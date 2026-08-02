// Cron-driven engagement notifications. Single edge function, dispatches sub-jobs by ?job=
// Schedules (set via pg_cron):
//   hourly  : ?job=price-drop, ?job=back-in-stock, ?job=trending-product
//   daily   : ?job=abandoned-favorites, ?job=viewed-still-available, ?job=lifecycle, ?job=recommendations
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { isFeatureEnabled } from '../_shared/featureGuard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function enqueue(args: {
  user_id: string;
  type: string;
  title: string;
  body: string;
  url: string;
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
  metadata?: Record<string, unknown>;
  image?: string;
  dedup_key?: string;
  priority?: string;
  dedup_ttl_hours?: number;
}) {
  const { data, error } = await admin.rpc('enqueue_notification', {
    _user_id: args.user_id,
    _type: args.type,
    _title: args.title,
    _body: args.body,
    _url: args.url,
    _entity_type: args.entity_type ?? null,
    _entity_id: args.entity_id ?? null,
    _actor_id: args.actor_id ?? null,
    _metadata: args.metadata ?? {},
    _image: args.image ?? null,
    _priority: args.priority ?? 'normal',
    _group_key: null,
    _dedup_key: args.dedup_key ?? null,
    _dedup_ttl_hours: args.dedup_ttl_hours ?? 24,
  });
  if (error) console.warn('[engagement-jobs] enqueue error', error.message);
  return data;
}

// ---------- Sub-jobs ----------

async function jobBackInStock(): Promise<number> {
  // Products that have quantity > 0 now, in users' favorites
  const { data: prods } = await admin
    .from('products')
    .select('id, slug, title, thumbnail_url, quantity, user_id, updated_at')
    .gt('quantity', 0)
    .gte('updated_at', new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString())
    .limit(500);
  let n = 0;
  for (const p of prods || []) {
    const { data: favs } = await admin
      .from('saved_items')
      .select('user_id')
      .eq('item_id', p.id)
      .eq('item_type', 'product')
      .limit(500);
    for (const f of favs || []) {
      if (!f.user_id || f.user_id === p.user_id) continue;
      await enqueue({
        user_id: f.user_id,
        type: 'back_in_stock',
        title: 'Back in stock',
        body: p.title + ' is available again',
        url: '/product/' + p.slug,
        entity_type: 'product',
        entity_id: p.id,
        actor_id: p.user_id,
        image: p.thumbnail_url || undefined,
        dedup_key: `back_in_stock:${p.id}:${f.user_id}`,
        dedup_ttl_hours: 24 * 7,
      });
      n++;
    }
  }
  return n;
}

async function jobAbandonedFavorites(): Promise<number> {
  // Items favorited 14d+ that user hasn't visited since
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await admin
    .from('saved_items')
    .select('user_id, item_id, created_at')
    .eq('item_type', 'product')
    .lt('created_at', since)
    .limit(500);
  let n = 0;
  for (const r of rows || []) {
    if (!r.user_id || !r.item_id) continue;
    const { data: prod } = await admin
      .from('products')
      .select('id, slug, title, thumbnail_url')
      .eq('id', r.item_id)
      .maybeSingle();
    if (!prod) continue;
    await enqueue({
      user_id: r.user_id,
      type: 'abandoned_favorite',
      title: 'Still interested?',
      body: prod.title + ' is waiting in your favorites',
      url: '/product/' + prod.slug,
      entity_type: 'product',
      entity_id: prod.id,
      image: prod.thumbnail_url || undefined,
      dedup_key: `abandoned_fav:${prod.id}:${r.user_id}`,
      dedup_ttl_hours: 24 * 14,
    });
    n++;
  }
  return n;
}

async function jobViewedStillAvailable(): Promise<number> {
  const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const to = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await admin
    .from('browsing_history')
    .select('user_id, product_id, visited_at')
    .gte('visited_at', from)
    .lte('visited_at', to)
    .limit(500);
  let n = 0;
  const seen = new Set<string>();
  for (const r of rows || []) {
    const key = `${r.user_id}:${r.product_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { data: prod } = await admin
      .from('products')
      .select('id, slug, title, thumbnail_url, status, quantity')
      .eq('id', r.product_id)
      .maybeSingle();
    if (!prod || prod.status !== 'active' || (prod.quantity ?? 0) <= 0) continue;
    await enqueue({
      user_id: r.user_id!,
      type: 'recommendation',
      title: 'Still available',
      body: prod.title + ' is still on P4NO',
      url: '/product/' + prod.slug,
      entity_type: 'product',
      entity_id: prod.id,
      image: prod.thumbnail_url || undefined,
      dedup_key: `viewed_still:${prod.id}:${r.user_id}`,
      dedup_ttl_hours: 24 * 7,
    });
    n++;
  }
  return n;
}

async function jobTrendingProduct(): Promise<number> {
  // Use popular_weekly_snapshots if present
  const { data: top } = await admin
    .from('popular_weekly_snapshots')
    .select('product_id, score')
    .order('score', { ascending: false })
    .limit(20);
  let n = 0;
  for (const t of top || []) {
    const { data: prod } = await admin
      .from('products')
      .select('id, slug, title, thumbnail_url, user_id')
      .eq('id', t.product_id)
      .maybeSingle();
    if (!prod) continue;
    // Notify product owner
    await enqueue({
      user_id: prod.user_id,
      type: 'trending_product',
      title: 'Your product is trending',
      body: prod.title + ' is among the top products this week',
      url: '/product/' + prod.slug,
      entity_type: 'product',
      entity_id: prod.id,
      image: prod.thumbnail_url || undefined,
      dedup_key: `trending_prod:${prod.id}:${new Date().toISOString().slice(0, 10)}`,
      dedup_ttl_hours: 24 * 7,
    });
    n++;
  }
  return n;
}

async function jobLifecycle(): Promise<number> {
  let n = 0;
  // Rate-purchase: orders delivered 3 days ago, no review yet
  const three = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const four = new Date(Date.now() - 4 * 24 * 3600 * 1000);
  const { data: orders } = await admin
    .from('orders')
    .select('id, buyer_id, seller_id, updated_at, status')
    .eq('status', 'delivered')
    .gte('updated_at', four.toISOString())
    .lte('updated_at', three.toISOString())
    .limit(200);
  for (const o of orders || []) {
    if (!o.buyer_id) continue;
    await enqueue({
      user_id: o.buyer_id,
      type: 'lifecycle',
      title: 'How was your purchase?',
      body: 'Leave a review for your recent order',
      url: '/account?tab=orders',
      entity_type: 'order',
      entity_id: o.id,
      dedup_key: `rate_order:${o.id}`,
      dedup_ttl_hours: 24 * 30,
    });
    n++;
  }
  return n;
}

async function jobRecommendations(): Promise<number> {
  // Use recommendation_index when present; one nudge per user/day max
  const { data: idx } = await admin
    .from('recommendation_index')
    .select('user_id, product_id, score')
    .order('score', { ascending: false })
    .limit(200);
  let n = 0;
  const sent = new Set<string>();
  for (const r of idx || []) {
    if (!r.user_id || !r.product_id || sent.has(r.user_id)) continue;
    sent.add(r.user_id);
    const { data: prod } = await admin
      .from('products')
      .select('id, slug, title, thumbnail_url')
      .eq('id', r.product_id)
      .maybeSingle();
    if (!prod) continue;
    await enqueue({
      user_id: r.user_id,
      type: 'recommendation',
      title: 'Recommended for you',
      body: prod.title,
      url: '/product/' + prod.slug,
      entity_type: 'product',
      entity_id: prod.id,
      image: prod.thumbnail_url || undefined,
      dedup_key: `reco:${r.user_id}:${new Date().toISOString().slice(0, 10)}`,
      dedup_ttl_hours: 24,
    });
    n++;
  }
  return n;
}

const JOBS: Record<string, () => Promise<number>> = {
  'back-in-stock': jobBackInStock,
  'abandoned-favorites': jobAbandonedFavorites,
  'viewed-still-available': jobViewedStillAvailable,
  'trending-product': jobTrendingProduct,
  'lifecycle': jobLifecycle,
  'recommendations': jobRecommendations,
};

// Jobs whose data source belongs to a toggleable module. When the module is
// disabled the job must not touch the database at all (not even cron state).
const JOB_FEATURE: Record<string, string> = {
  'trending-product': 'popular_this_week',
  'abandoned-favorites': 'recently_viewed',
  'viewed-still-available': 'recently_viewed',
  'recommendations': 'recently_viewed',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  const job = url.searchParams.get('job') || 'all';
  const results: Record<string, number | string> = {};

  const jobList = job === 'all' ? Object.keys(JOBS) : [job];
  for (const name of jobList) {
    const fn = JOBS[name];
    if (!fn) {
      results[name] = 'unknown_job';
      continue;
    }
    const feature = JOB_FEATURE[name];
    if (feature && !(await isFeatureEnabled(feature))) {
      results[name] = 'feature_disabled';
      continue;
    }
    try {
      results[name] = await fn();
      await admin.from('engagement_cron_state').upsert({
        job_name: name,
        last_run_at: new Date().toISOString(),
        meta: { count: results[name] },
      });
    } catch (e) {
      console.error('[engagement-jobs]', name, e);
      results[name] = `err: ${String((e as Error).message || e).slice(0, 200)}`;
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
