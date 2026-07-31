import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { guardFeature } from '../_shared/featureGuard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RECS_PER_USER = 3;
const ACTIVE_WINDOW_DAYS = 14;

interface ProductLite {
  id: string;
  title: string;
  slug?: string | null;
  category_id?: string | null;
  images?: any;
  price?: number | null;
  user_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  // Background Guard — the recommendation engine depends on interest tracking.
  const stop = await guardFeature('recently_viewed', corsHeaders);
  if (stop) return stop;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let processed = 0;
  let created = 0;

  try {
    // 1. Get active users with interest profiles
    const sinceISO = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400_000).toISOString();
    const { data: profiles } = await supabase
      .from('user_interest_profiles')
      .select('user_id, category_weights, tag_weights, preferred_hours, last_active_at')
      .gte('last_active_at', sinceISO)
      .limit(500);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nowHour = new Date().getUTCHours();

    for (const profile of profiles) {
      processed++;
      const userId = profile.user_id as string;
      const preferred: number[] = (profile.preferred_hours as number[]) || [9, 12, 18, 20];
      // Skip if not in preferred hour window (+/- 1 hour)
      const inWindow = preferred.some((h) => Math.abs(h - nowHour) <= 1);
      if (!inWindow) continue;

      // Check preferences opt-in
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('recommendations_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      if (prefs && (prefs as any).recommendations_enabled === false) continue;

      // Rate limit: max 1 recommendation per user per day
      const dayAgo = new Date(Date.now() - 86400_000).toISOString();
      const { count: recentCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'recommendation')
        .gte('created_at', dayAgo);
      if ((recentCount ?? 0) > 0) continue;

      // Pick top category
      const catW = (profile.category_weights as Record<string, number>) || {};
      const sortedCats = Object.entries(catW).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);
      if (sortedCats.length === 0) continue;

      // Find recent products in those categories not yet seen
      const dayWindowISO = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: candidates } = await supabase
        .from('products')
        .select('id, title, slug, category_id, images, price, user_id')
        .in('category_id', sortedCats)
        .gte('created_at', dayWindowISO)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!candidates || candidates.length === 0) continue;

      // Filter out already-notified
      const ids = candidates.map((c: ProductLite) => c.id);
      const { data: dupes } = await supabase
        .from('notifications')
        .select('entity_id')
        .eq('user_id', userId)
        .eq('type', 'recommendation')
        .in('entity_id', ids)
        .gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString());
      const dupeSet = new Set((dupes || []).map((d: any) => d.entity_id));

      const fresh = candidates.filter((c: ProductLite) => !dupeSet.has(c.id)).slice(0, MAX_RECS_PER_USER);
      if (fresh.length === 0) continue;

      // Pick the top one as the notification
      const pick = fresh[0] as ProductLite;
      const imageUrl = Array.isArray(pick.images) ? pick.images[0] : null;
      const actionUrl = `/product/${pick.slug || pick.id}`;

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Picked for you',
        message: pick.title,
        type: 'recommendation',
        entity_type: 'product',
        entity_id: pick.id,
        image_url: imageUrl,
        action_url: actionUrl,
        priority: 'low',
        is_read: false,
      });
      created++;
    }

    return new Response(JSON.stringify({ ok: true, processed, created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-recommendations error', err);
    return new Response(JSON.stringify({ error: String(err), processed, created }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
