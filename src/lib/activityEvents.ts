// Public browsing analytics are permanently disabled.
// ------------------------------------------------------------------
// `activity_events` writes caused by simply viewing pages, cards, shops or
// providers produced thousands of pointless INSERTs. logActivity is now an
// inert no-op: no queue, no timers, no lifecycle listeners, no network.
// Do not reintroduce batching or a replacement tracking pipeline here.

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

/** No-op. Public browsing must not generate analytics writes. */
export const logActivity = async (_params: LogParams): Promise<void> => {};

/** No-op kept for the monitor's flush hooks. */
export async function flushActivityEvents(): Promise<void> {}

/** Diagnostics for the Unified Monitor (no network, no database). */
export function getActivityQueueStats() {
  return { queued: 0, flushing: false, pendingFlush: false };
}
