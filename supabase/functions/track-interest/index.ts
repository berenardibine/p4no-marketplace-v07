import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WEIGHTS: Record<string, number> = {
  product_view: 1,
  product_click: 2,
  save: 4,
  follow: 5,
  share: 3,
  article_view: 1,
  service_view: 1,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const { event_type, entity_type, entity_id, category, tags } = body || {};
    if (!event_type) {
      return new Response(JSON.stringify({ error: 'event_type required' }), { status: 400, headers: corsHeaders });
    }

    const weight = WEIGHTS[event_type] ?? 1;

    // Log event
    await supabase.from('recommendation_events').insert({
      user_id: user.id,
      event_type,
      entity_type: entity_type ?? null,
      entity_id: entity_id ?? null,
      weight,
      metadata: { category, tags },
    });

    // Update profile weights incrementally
    const { data: profile } = await supabase
      .from('user_interest_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const catW: Record<string, number> = (profile?.category_weights as any) || {};
    const tagW: Record<string, number> = (profile?.tag_weights as any) || {};

    if (category && typeof category === 'string') {
      catW[category] = (catW[category] || 0) + weight;
    }
    if (Array.isArray(tags)) {
      for (const t of tags) {
        if (typeof t === 'string') tagW[t] = (tagW[t] || 0) + weight;
      }
    }

    await supabase.from('user_interest_profiles').upsert({
      user_id: user.id,
      category_weights: catW,
      tag_weights: tagW,
      last_active_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('track-interest error', err);
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: corsHeaders });
  }
});
