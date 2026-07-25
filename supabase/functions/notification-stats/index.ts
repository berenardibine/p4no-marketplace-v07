// Aggregate notification metrics for the admin push dashboard.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function isAdmin(userId: string | null) {
  if (!userId) return false;
  const { data } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Admin guard
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let callerId: string | null = null;
  if (token && token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    const { data } = await admin.auth.getUser(token);
    callerId = data?.user?.id ?? null;
  }
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const isService = !!serviceKey && token === serviceKey;
  if (!isService && !(await isAdmin(callerId))) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // Status counts (24h)
  const statuses = ['pending', 'sent', 'delivered', 'clicked', 'dismissed', 'failed', 'grouped'];
  const counts: Record<string, number> = {};
  await Promise.all(
    statuses.map(async (s) => {
      const { count } = await admin
        .from('notification_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', s)
        .gte('created_at', since24);
      counts[s] = count ?? 0;
    })
  );

  // Retry queue depth (pending with attempts > 0)
  const { count: retryDepth } = await admin
    .from('notification_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gt('attempts', 0);

  // Dead tokens last 24h
  const { count: deadTokens } = await admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', false)
    .gte('updated_at', since24);

  // Top notification types last 7d
  const { data: typeRows } = await admin
    .from('notification_queue')
    .select('notification_type, status')
    .gte('created_at', since7)
    .limit(5000);
  const byType: Record<string, { sent: number; clicked: number; total: number }> = {};
  for (const r of typeRows || []) {
    const t = r.notification_type || 'unknown';
    byType[t] ??= { sent: 0, clicked: 0, total: 0 };
    byType[t].total++;
    if (['sent', 'delivered', 'clicked'].includes(r.status)) byType[t].sent++;
    if (r.status === 'clicked') byType[t].clicked++;
  }
  const topTypes = Object.entries(byType)
    .map(([type, v]) => ({ type, ...v, ctr: v.sent ? v.clicked / v.sent : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const sentLike = (counts.sent || 0) + (counts.delivered || 0) + (counts.clicked || 0);
  const deliveryRate = sentLike ? (counts.delivered + counts.clicked) / sentLike : 0;
  const ctr = counts.delivered + counts.clicked
    ? counts.clicked / (counts.delivered + counts.clicked)
    : 0;

  return new Response(
    JSON.stringify({
      ok: true,
      window_hours: 24,
      counts,
      retry_depth: retryDepth ?? 0,
      dead_tokens_24h: deadTokens ?? 0,
      delivery_rate: deliveryRate,
      ctr,
      top_types: topTypes,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
