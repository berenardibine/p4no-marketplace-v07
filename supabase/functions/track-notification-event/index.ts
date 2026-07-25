// Anonymous endpoint hit by the service worker to record delivered/clicked.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const ALLOWED = new Set(['delivered', 'clicked', 'opened', 'dismissed', 'failed']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const event = String(body.event || '');
    if (!ALLOWED.has(event)) {
      return new Response(JSON.stringify({ error: 'bad event' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const queue_id =
      typeof body.queue_id === 'string' && body.queue_id.length === 36
        ? body.queue_id
        : null;
    const user_id =
      typeof body.user_id === 'string' && body.user_id.length === 36
        ? body.user_id
        : null;

    await admin.from('notification_events').insert({
      queue_id,
      user_id,
      event,
      meta: body.meta || null,
    });

    if (event === 'clicked' && queue_id) {
      await admin
        .from('notification_queue')
        .update({ status: 'clicked' })
        .eq('id', queue_id);
    } else if (event === 'delivered' && queue_id) {
      await admin
        .from('notification_queue')
        .update({ status: 'delivered' })
        .eq('id', queue_id)
        .in('status', ['sent', 'pending']);
    } else if (event === 'dismissed' && queue_id) {
      await admin
        .from('notification_queue')
        .update({ status: 'dismissed' })
        .eq('id', queue_id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error).message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
