import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useFCMPush } from '@/hooks/useFCMPush';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  useEngagementTrigger,
  markPushDismissed,
  markPushPrompted,
  markPushDenied,
} from '@/hooks/useEngagementTrigger';
import NotificationPermissionModal from './NotificationPermissionModal';

/**
 * Initializes FCM push:
 * - Silently refreshes the FCM token if permission is already granted.
 * - Never prompts guests.
 * - Checks push_subscriptions for an active token before prompting.
 * - Engagement-gated permission modal that never gets stuck.
 */
const PushNotificationInit = () => {
  const { user } = useAuth();
  const { isSupported, subscribe } = useFCMPush();
  const [enabling, setEnabling] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasServerSub, setHasServerSub] = useState<boolean | null>(null);

  // Engagement-based prompting is disabled, so we no longer query
  // push_subscriptions on load. Users enable notifications from settings.

  const eligible =
    !!user &&
    isSupported &&
    hasServerSub === false &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'default';

  const shouldPrompt = useEngagementTrigger(eligible);

  useEffect(() => {
    if (shouldPrompt && !open && !enabling) setOpen(true);
  }, [shouldPrompt, open, enabling]);

  const handleEnable = async () => {
    if (enabling) return;
    setEnabling(true);
    try {
      // Permission denied path
      if (Notification.permission === 'denied') {
        markPushDenied();
        toast.error('Notifications are blocked in your browser settings.');
        setOpen(false);
        return;
      }

      const token = await subscribe();

      if (!token) {
        // Either denied during prompt or token gen failed
        const perm = (Notification as any).permission as string;
        if (perm === 'denied') {
          markPushDenied();
          toast.error('Notifications blocked. You can enable them later from settings.');
        } else {
          toast.error('Could not enable notifications. Please try again.');
        }
        setOpen(false);
        return;
      }

      // Verify save success on server
      if (user) {
        const { data } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('fcm_token', token)
          .eq('is_active', true)
          .maybeSingle();
        if (!data) {
          toast.error('Could not save your notification token. Please try again.');
          setOpen(false);
          return;
        }
      }

      markPushPrompted();
      setHasServerSub(true);
      setOpen(false);
      toast.success("You're all set! We'll keep you updated.");
    } catch (err) {
      console.error('[Push] enable failed', err);
      toast.error('Something went wrong. Please try again.');
      setOpen(false);
    } finally {
      setEnabling(false);
    }
  };

  const handleDismiss = () => {
    if (enabling) return;
    markPushDismissed();
    setOpen(false);
  };

  if (!user) return null;

  return (
    <NotificationPermissionModal
      open={open}
      enabling={enabling}
      onEnable={handleEnable}
      onDismiss={handleDismiss}
    />
  );
};

export default PushNotificationInit;
