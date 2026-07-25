// Collapses bursts of same-type pending notifications into a single summary push.
// Runs every 5 min by pg_cron.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const TYPE_LABEL: Record<string, string> = {
  comment: 'new comments',
  qa_reply: 'new question replies',
  follow: 'new followers',
  badge: 'new badges',
  message: 'new messages',
  article: 'new articles',
};
const TYPE_URL: Record<string, string> = {
  comment: '/notifications',
  qa_reply: '/notifications',
  follow: '/notifications',
  badge: '/account?tab=badges',
  message: '/notifications',
  article: '/insights',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });

  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: rows } = await admin
    .from('notification_queue')
    .select('id, user_id, notification_type')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .is('group_key', null)
    .limit(2000);

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, grouped: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Bucket by (user, type)
  const buckets = new Map<string, { user_id: string; type: string; ids: string[] }>();
  for (const r of rows) {
    const k = `${r.user_id}|${r.notification_type}`;
    if (!buckets.has(k))
      buckets.set(k, { user_id: r.user_id, type: r.notification_type, ids: [] });
    buckets.get(k)!.ids.push(r.id);
  }

  let groupedCount = 0;

  for (const b of buckets.values()) {
    if (b.ids.length < 4) continue; // only group when 4+
    const label = TYPE_LABEL[b.type] || 'updates';
    const url = TYPE_URL[b.type] || '/notifications';
    const gkey = `g:${b.type}:${Date.now()}`;

    // Mark originals as grouped (no push, inbox row already exists)
    await admin
      .from('notification_queue')
      .update({ status: 'grouped', group_key: gkey })
      .in('id', b.ids);

    // Insert one summary push
    await admin.from('notification_queue').insert({
      user_id: b.user_id,
      notification_type: b.type,
      title: 'P4NO',
      body: `${b.ids.length} ${label} while you were away`,
      url,
      priority: 'normal',
      status: 'pending',
      scheduled_for: new Date().toISOString(),
      next_attempt_at: new Date().toISOString(),
      group_key: gkey,
    });
    groupedCount += b.ids.length;
  }

  return new Response(
    JSON.stringify({ ok: true, grouped: groupedCount, buckets: buckets.size }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
