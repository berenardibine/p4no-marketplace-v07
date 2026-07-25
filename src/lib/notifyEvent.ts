import { supabase } from '@/integrations/supabase/client';

export type NotifyEventType =
  | 'qa_reply'
  | 'comment'
  | 'follow'
  | 'badge'
  | 'message'
  | 'article';

export interface NotifyEventInput {
  type: NotifyEventType;
  target_user_id: string;
  title?: string;
  body?: string;
  url?: string;
  data?: Record<string, string>;
}

/**
 * Fire-and-forget push notification trigger.
 * Never throws — push must never break the underlying user action.
 */
export async function notifyEvent(input: NotifyEventInput): Promise<void> {
  try {
    if (!input.target_user_id) return;
    await supabase.functions.invoke('send-push', {
      body: { mode: 'event', ...input },
    });
  } catch (err) {
    console.warn('[notifyEvent] failed (ignored):', err);
  }
}