// Supabase Edge Function: send-push
//
// Modes:
//   - mode: 'event'      → authenticated user triggers a notification for a target user
//   - mode: 'test'       → admin sends a test notification to a user
//   - mode: 'broadcast'  → admin sends to all active subscribers
//
// Uses Firebase Cloud Messaging HTTP v1 with a service-account JWT.
// Secrets required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL') || '';
// Private key may arrive with literal \n, surrounding quotes, or already as multi-line PEM.
const FIREBASE_PRIVATE_KEY = (Deno.env.get('FIREBASE_PRIVATE_KEY') || '')
  .replace(/^"|"$/g, '')
  .replace(/\\n/g, '\n')
  .trim();

function diag() {
  return {
    has_project_id: !!FIREBASE_PROJECT_ID,
    has_client_email: !!FIREBASE_CLIENT_EMAIL,
    has_private_key: !!FIREBASE_PRIVATE_KEY,
    private_key_starts_with_begin: FIREBASE_PRIVATE_KEY.startsWith('-----BEGIN'),
    private_key_length: FIREBASE_PRIVATE_KEY.length,
    project_id: FIREBASE_PROJECT_ID,
    client_email_domain: FIREBASE_CLIENT_EMAIL.split('@')[1] || null,
  };
}

// ── OAuth2 access token (cached per cold start) ─────────────────────────────
let cachedToken: { token: string; exp: number } | null = null;

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp - 60 > Math.floor(Date.now() / 1000)) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const headerEnc = base64UrlEncode(JSON.stringify(header));
  const claimsEnc = base64UrlEncode(JSON.stringify(claims));
  const unsigned = `${headerEnc}.${claimsEnc}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(FIREBASE_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sig))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.token;
}

// ── FCM send ────────────────────────────────────────────────────────────────
interface PushPayload {
  title: string;
  body: string;
  url?: string;
  image?: string;
  data?: Record<string, string>;
  tag?: string;
}

async function sendToToken(
  accessToken: string,
  fcmToken: string,
  payload: PushPayload
): Promise<{ ok: boolean; status: number; error?: string }> {
  const dataPayload: Record<string, string> = {
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    tag: payload.tag || 'p4no',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    ...(payload.image ? { image: payload.image } : {}),
    ...(payload.data || {}),
  };

  const message = {
    message: {
      token: fcmToken,
      // Data-only payload so the SW always decides how to render — works
      // consistently across foreground / background / closed PWA.
      data: dataPayload,
      webpush: {
        fcm_options: { link: payload.url || '/' },
        // TTL 24h — FCM stores the message and delivers it as soon as the
        // device reconnects, so offline users still receive it later.
        headers: { Urgency: 'high', TTL: '86400' },
        // Fallback notification block: if the service worker fails to run
        // for any reason, the browser still renders a system notification
        // with the P4NO logo. When the SW runs (normal case), it renders
        // its own richer notification and this block is superseded.
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          image: payload.image,
          tag: payload.tag || 'p4no',
          requireInteraction: false,
          vibrate: [100, 50, 100],
        },
      },
      android: {
        priority: 'HIGH',
        notification: {
          channel_id: 'p4no_default',
          icon: 'ic_notification',
          color: '#0F172A',
          sound: 'default',
          default_vibrate_timings: true,
          default_light_settings: true,
        },
      },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }
  );
  if (res.ok) {
    await res.text();
    return { ok: true, status: res.status };
  }
  const text = await res.text();
  return { ok: false, status: res.status, error: text };
}


// ── Preference gating ───────────────────────────────────────────────────────
const TYPE_TO_PREF: Record<string, string> = {
  qa_reply: 'qa_enabled',
  comment: 'comments_enabled',
  follow: 'follows_enabled',
  badge: 'badges_enabled',
  message: 'messages_enabled',
  article: 'articles_enabled',
};

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode: 'event' | 'test' | 'broadcast' | 'admin' = body.mode || 'event';

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth: identify caller for event/test/broadcast/admin
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const isServiceRoleCaller =
      !!token && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    let callerId: string | null = null;
    if (token && !isServiceRoleCaller) {
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr) console.warn('[send-push] getUser error:', userErr.message);
      callerId = userData?.user?.id || null;
    }
    console.log('[send-push] mode=', mode, 'caller=', callerId, 'sr=', isServiceRoleCaller);

    // ── Resolve target users + payload ─────────────────────────────────────
    let targetUserIds: string[] = [];
    let payload: PushPayload;
    let notificationType = String(body.type || mode);

    if (mode === 'event') {
      if (!callerId) return json({ error: 'Unauthorized' }, 401);
      if (!body.target_user_id) return json({ error: 'target_user_id required' }, 400);
      // Never push to yourself
      if (body.target_user_id === callerId) return json({ ok: true, skipped: 'self' });
      targetUserIds = [body.target_user_id];
      const defaults = defaultPayloadFor(notificationType);
      payload = {
        title: body.title || defaults.title,
        body: body.body || defaults.body,
        url: body.url || defaults.url,
        image: body.image,
        data: body.data,
        tag: notificationType,
      };
    } else if (mode === 'test') {
      if (!(await isAdmin(admin, callerId))) return json({ error: 'Forbidden' }, 403);
      if (!body.target_user_id) return json({ error: 'target_user_id required' }, 400);
      targetUserIds = [body.target_user_id];
      payload = {
        title: 'P4NO Test Notification',
        body: 'Push notifications are working successfully.',
        url: '/',
        tag: 'test',
      };
      notificationType = 'test';
    } else if (mode === 'broadcast') {
      if (!(await isAdmin(admin, callerId))) return json({ error: 'Forbidden' }, 403);
      payload = {
        title: String(body.title || 'P4NO'),
        body: String(body.body || ''),
        url: String(body.url || '/'),
        tag: 'broadcast',
      };
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('user_id')
        .eq('is_active', true);
      targetUserIds = Array.from(
        new Set((subs || []).map((s: any) => s.user_id).filter(Boolean))
      ) as string[];
      notificationType = 'broadcast';
    } else if (mode === 'admin') {
      // Admin-composed push: either to a user group (all/sellers/buyers)
      // or directly to a list of user ids (used by internal scheduled fns).
      if (!isServiceRoleCaller && !(await isAdmin(admin, callerId))) {
        return json({ error: 'Forbidden' }, 403);
      }
      payload = {
        title: String(body.title || 'P4NO'),
        body: String(body.body || ''),
        url: String(body.url || '/'),
        image: body.image,
        tag: String(body.type || 'admin'),
      };
      if (Array.isArray(body.target_user_ids) && body.target_user_ids.length) {
        targetUserIds = body.target_user_ids.filter(Boolean);
      } else {
        const group: 'all' | 'sellers' | 'buyers' = body.target_group || 'all';
        let q = admin.from('profiles').select('id');
        if (group === 'sellers') q = q.eq('user_type', 'seller');
        else if (group === 'buyers') q = q.eq('user_type', 'buyer');
        else q = q.in('user_type', ['seller', 'buyer']);
        const { data: targets } = await q;
        targetUserIds = (targets || []).map((t: any) => t.id);
      }
      notificationType = String(body.type || 'admin');
    } else {
      return json({ error: 'Invalid mode' }, 400);
    }

    // ── Filter by user preference ──────────────────────────────────────────
    const prefCol = TYPE_TO_PREF[notificationType];
    if (prefCol && targetUserIds.length) {
      const { data: prefs } = await admin
        .from('notification_preferences')
        .select(`user_id, ${prefCol}`)
        .in('user_id', targetUserIds);
      const disabled = new Set(
        (prefs || [])
          .filter((p: any) => p[prefCol] === false)
          .map((p: any) => p.user_id)
      );
      targetUserIds = targetUserIds.filter((u) => !disabled.has(u));
    }
    if (!targetUserIds.length) return json({ ok: true, sent: 0, skipped: 'no_targets' });

    // ── Fetch active tokens ────────────────────────────────────────────────
    const { data: subs, error: subsErr } = await admin
      .from('push_subscriptions')
      .select('user_id, fcm_token')
      .in('user_id', targetUserIds)
      .eq('is_active', true);
    if (subsErr) return json({ error: subsErr.message }, 500);
    if (!subs || !subs.length) return json({ ok: true, sent: 0, skipped: 'no_tokens' });

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (e) {
      console.error('[send-push] getAccessToken failed:', e);
      return json(
        {
          error: 'firebase_auth_failed',
          detail: String((e as Error).message || e),
          diag: diag(),
        },
        500
      );
    }

    let sent = 0;
    let failed = 0;
    const deadTokens: string[] = [];
    const logs: any[] = [];

    for (const sub of subs) {
      const result = await sendToToken(accessToken, sub.fcm_token, payload);
      if (result.ok) {
        sent++;
        logs.push({
          user_id: sub.user_id,
          notification_type: notificationType,
          title: payload.title,
          body: payload.body,
          status: 'sent',
          data: { url: payload.url || '/' },
        });
      } else {
        failed++;
        // FCM returns 404 / 400 (UNREGISTERED / INVALID_ARGUMENT) for dead tokens
        if (result.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(result.error || '')) {
          deadTokens.push(sub.fcm_token);
        }
        logs.push({
          user_id: sub.user_id,
          notification_type: notificationType,
          title: payload.title,
          body: payload.body,
          status: 'failed',
          data: { error: result.error?.slice(0, 500), status: result.status },
        });
      }
    }

    if (deadTokens.length) {
      await admin
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('fcm_token', deadTokens);
    }
    if (logs.length) {
      await admin.from('notification_logs').insert(logs);
    }

    return json({ ok: true, sent, failed, dead_tokens: deadTokens });
  } catch (err) {
    console.error('[send-push] fatal:', err);
    return json(
      {
        error: String((err as Error).message || err),
        stack: (err as Error).stack?.slice(0, 1000),
        diag: diag(),
      },
      500
    );
  }
});

async function isAdmin(admin: any, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
  return !!data;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function defaultPayloadFor(type: string): PushPayload {
  switch (type) {
    case 'qa_reply':
      return { title: 'New Reply', body: 'Someone replied to your question.', url: '/' };
    case 'comment':
      return { title: 'New Comment', body: 'Someone commented on your product.', url: '/' };
    case 'follow':
      return { title: 'New Follower', body: 'Someone started following you.', url: '/account' };
    case 'badge':
      return { title: 'Achievement Unlocked', body: 'You earned a new seller badge.', url: '/my-shop' };
    case 'message':
      return { title: 'New Message', body: 'You received a new message.', url: '/notifications' };
    case 'article':
      return { title: 'New Article', body: 'A new article was published.', url: '/insights' };
    default:
      return { title: 'P4NO', body: '', url: '/' };
  }
}