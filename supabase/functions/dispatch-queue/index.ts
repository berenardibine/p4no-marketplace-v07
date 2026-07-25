// Dispatches pending notification_queue rows with retry, dedup, and token hygiene.
// Designed to be called every minute by pg_cron.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// Backoff in seconds for attempts 1..4
// Retry ladder: 1m, 5m, 15m, 1h, 24h
const BACKOFF_SECONDS = [0, 60, 300, 900, 3600, 86400];
const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });

  const nowIso = new Date().toISOString();
  const { data: pending } = await admin
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_attempt_at', nowIso)
    .order('priority', { ascending: false })
    .order('next_attempt_at', { ascending: true })
    .limit(200);

  let ok = 0,
    fail = 0,
    deadTokens = 0;

  for (const row of pending || []) {
    try {
      // Insert inbox notification only on first attempt
      if (!row.attempts || row.attempts === 0) {
        await admin.from('notifications').insert({
          user_id: row.user_id,
          type: row.notification_type,
          title: row.title,
          message: row.body,
          action_url: row.url,
          image_url: row.image_url,
          priority: row.priority,
          entity_type: row.entity_type ?? null,
          entity_id: row.entity_id ?? null,
          actor_id: row.actor_id ?? null,
          metadata: row.metadata ?? {},
          group_key: row.group_key ?? null,
        });
      }

      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({
          mode: 'admin',
          target_user_ids: [row.user_id],
          type: row.notification_type,
          title: row.title,
          body: row.body,
          url: row.url || '/',
          image: row.image_url,
          data: {
            queue_id: row.id,
            type: row.notification_type,
            entity_type: row.entity_type ?? '',
            entity_id: row.entity_id ?? '',
            actor_id: row.actor_id ?? '',
            targetUrl: row.url || '/',
            ...(row.metadata && typeof row.metadata === 'object'
              ? Object.fromEntries(
                  Object.entries(row.metadata).map(([k, v]) => [k, String(v ?? '')])
                )
              : {}),
          },
        }),
      });

      const text = await r.text();
      if (!r.ok) throw new Error(`push ${r.status}: ${text.slice(0, 200)}`);

      // Detect dead-token responses from send-push payload
      try {
        const parsed = JSON.parse(text);
        if (parsed?.dead_tokens?.length) {
          deadTokens += parsed.dead_tokens.length;
          await admin
            .from('push_subscriptions')
            .update({ is_active: false })
            .in('fcm_token', parsed.dead_tokens);
        }
      } catch {
        /* ignore parse errors */
      }

      await admin
        .from('notification_queue')
        .update({ status: 'sent', sent_at: nowIso })
        .eq('id', row.id);
      ok++;
    } catch (e) {
      const attempts = (row.attempts || 0) + 1;
      const giveUp = attempts >= MAX_ATTEMPTS;
      const delay =
        BACKOFF_SECONDS[Math.min(attempts, BACKOFF_SECONDS.length - 1)] || 1800;
      const nextAt = new Date(Date.now() + delay * 1000).toISOString();
      await admin
        .from('notification_queue')
        .update({
          status: giveUp ? 'failed' : 'pending',
          attempts,
          next_attempt_at: nextAt,
          last_error: String((e as Error).message || e).slice(0, 500),
        })
        .eq('id', row.id);
      if (giveUp) {
        await admin.from('notification_events').insert({
          queue_id: row.id,
          user_id: row.user_id,
          event: 'failed',
          meta: { error: String((e as Error).message || e).slice(0, 500) },
        });
      }
      fail++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: pending?.length || 0,
      sent: ok,
      failed: fail,
      dead_tokens: deadTokens,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
