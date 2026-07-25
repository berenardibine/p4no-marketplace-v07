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

// Throttle duplicates within 5 minutes per (event,entity)
const recent = new Map<string, number>();
const TTL = 5 * 60 * 1000;

export const logActivity = async ({
  event_type, entity_type = null, entity_id = null, metadata = {}, user_id = null,
}: LogParams) => {
  try {
    const key = `${event_type}:${entity_type}:${entity_id}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < TTL) return;
    recent.set(key, now);

    let uid = user_id;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id ?? null;
    }
    await supabase.from('activity_events').insert({
      event_type, entity_type, entity_id, metadata, user_id: uid,
    });
  } catch (err) {
    // best-effort, never throw
    console.warn('activity_event insert failed', err);
  }
};
