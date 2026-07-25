import { supabase } from '@/integrations/supabase/client';

export type InterestEventType =
  | 'product_view'
  | 'product_click'
  | 'save'
  | 'follow'
  | 'share'
  | 'article_view'
  | 'service_view';

interface TrackInterestInput {
  event_type: InterestEventType;
  entity_type?: string;
  entity_id?: string;
  category?: string | null;
  tags?: string[] | null;
}

// Throttle duplicates within 10 minutes per (event, entity)
const recent = new Map<string, number>();
const TTL = 10 * 60 * 1000;

/**
 * Fire-and-forget interest signal for personalized recommendations.
 * Silently no-ops for guests and on errors — never blocks user actions.
 */
export async function trackInterest(input: TrackInterestInput): Promise<void> {
  try {
    const key = `${input.event_type}:${input.entity_type ?? ''}:${input.entity_id ?? ''}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < TTL) return;
    recent.set(key, now);

    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    await supabase.functions.invoke('track-interest', { body: input });
  } catch (err) {
    console.warn('[trackInterest] failed (ignored):', err);
  }
}
