// Activity event batching.
// ------------------------------------------------------------------
// The forensic audit measured 24+ individual `activity_events` INSERTs on a
// single homepage view — one round trip per impression. Events are now queued
// locally and flushed as ONE multi-row insert.
//
// Rules honoured here:
//   • no background polling — the timer only exists while the queue is non-empty
//   • flush on threshold, on a short idle delay, and on page hide/unload
//   • duplicate suppression per (event, entity) within 5 minutes
//   • bounded queue, so a broken network can never grow memory without limit
//   • failed batches are retried once, then dropped (analytics is best-effort)

import { supabase } from '@/integrations/supabase/client';

export type ActivityEventType =
  | 'product_view'
  | 'product_impression'
  | 'product_click'
  | 'service_view'
  | 'service_click'
  | 'shop_view'
  | 'provider_view'
  | 'follow'
  | 'save';

interface LogParams {
  event_type: ActivityEventType;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, any>;
  user_id?: string | null;
}

interface QueuedEvent {
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, any>;
  user_id: string | null;
  _attempts: number;
}

// Throttle duplicates within 5 minutes per (event,entity)
const recent = new Map<string, number>();
const TTL = 5 * 60 * 1000;

const FLUSH_DELAY_MS = 4000;
const FLUSH_THRESHOLD = 12;
const MAX_QUEUE = 200;
const MAX_ATTEMPTS = 2;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let cachedUid: string | null | undefined;
let listenersBound = false;

/** Resolved once per session instead of once per event. */
async function resolveUid(): Promise<string | null> {
  if (cachedUid !== undefined) return cachedUid;
  try {
    const { data } = await supabase.auth.getUser();
    cachedUid = data.user?.id ?? null;
  } catch {
    cachedUid = null;
  }
  return cachedUid;
}

function bindLifecycle() {
  if (listenersBound || typeof document === 'undefined') return;
  listenersBound = true;
  const onHide = () => { void flushActivityEvents(); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
  window.addEventListener('pagehide', onHide);
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushActivityEvents();
  }, FLUSH_DELAY_MS);
}

/** Send everything queued as a single insert. Safe to call at any time. */
export async function flushActivityEvents(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue;
  queue = [];
  if (timer) { clearTimeout(timer); timer = null; }
  try {
    const rows = batch.map(({ _attempts, ...row }) => row);
    const { error } = await supabase.from('activity_events').insert(rows);
    if (error) throw error;
  } catch (err) {
    // Retry once by putting the batch back; drop after MAX_ATTEMPTS.
    const retryable = batch
      .map((e) => ({ ...e, _attempts: e._attempts + 1 }))
      .filter((e) => e._attempts < MAX_ATTEMPTS);
    if (retryable.length) {
      queue = retryable.concat(queue).slice(0, MAX_QUEUE);
      schedule();
    } else {
      console.warn('activity_events batch dropped', err);
    }
  } finally {
    flushing = false;
    if (queue.length) schedule();
  }
}

export const logActivity = async ({
  event_type, entity_type = null, entity_id = null, metadata = {}, user_id = null,
}: LogParams) => {
  try {
    const key = `${event_type}:${entity_type}:${entity_id}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < TTL) return;
    recent.set(key, now);

    const uid = user_id ?? (await resolveUid());
    bindLifecycle();

    if (queue.length >= MAX_QUEUE) queue.shift();
    queue.push({ event_type, entity_type, entity_id, metadata, user_id: uid, _attempts: 0 });

    if (queue.length >= FLUSH_THRESHOLD) void flushActivityEvents();
    else schedule();
  } catch (err) {
    // best-effort, never throw
    console.warn('activity_event queue failed', err);
  }
};

/** Diagnostics for the Unified Monitor (no network, no database). */
export function getActivityQueueStats() {
  return { queued: queue.length, flushing, pendingFlush: !!timer };
}
