import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import {
  requestFcmToken,
  onForegroundMessage,
  detectBrowser,
  detectDeviceType,
} from '@/lib/firebase';

/**
 * Firebase Cloud Messaging hook.
 * - subscribe(): asks for permission, generates an FCM token, persists it in push_subscriptions.
 * - Auto re-syncs token on login (idempotent — unique on fcm_token).
 * - Surfaces foreground notifications as toasts.
 */
export const useFCMPush = () => {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const fgUnsubRef = useRef<(() => void) | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window;

  const persistToken = useCallback(
    async (fcmToken: string) => {
      if (!fcmToken) return;
      try {
        await supabase.from('push_subscriptions').upsert(
          {
            user_id: user?.id || null,
            fcm_token: fcmToken,
            browser: detectBrowser(),
            device_type: detectDeviceType(),
            is_active: true,
            last_active_at: new Date().toISOString(),
          },
          { onConflict: 'fcm_token' }
        );
      } catch (err) {
        console.error('[FCM] persistToken failed:', err);
      }
    },
    [user?.id]
  );

  const subscribe = useCallback(async (): Promise<string | null> => {
    if (!isSupported) return null;
    if (Notification.permission === 'denied') return null;

    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
    }

    const fcmToken = await requestFcmToken();
    if (!fcmToken) {
      toast.error('Could not enable notifications. Please try again.');
      return null;
    }
    setToken(fcmToken);
    setIsSubscribed(true);
    await persistToken(fcmToken);
    return fcmToken;
  }, [isSupported, persistToken]);

  const unsubscribe = useCallback(async () => {
    if (!token) return;
    try {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('fcm_token', token);
      setIsSubscribed(false);
    } catch (err) {
      console.error('[FCM] unsubscribe failed:', err);
    }
  }, [token]);

  // If permission already granted on load, silently refresh the token (no prompt).
  useEffect(() => {
    if (!isSupported) return;
    if (Notification.permission !== 'granted') return;
    (async () => {
      const fcmToken = await requestFcmToken();
      if (fcmToken) {
        setToken(fcmToken);
        setIsSubscribed(true);
        await persistToken(fcmToken);
      }
    })();
  }, [isSupported, persistToken]);

  // Foreground message → toast.
  useEffect(() => {
    let active = true;
    (async () => {
      const unsub = await onForegroundMessage((payload: any) => {
        const title = payload?.notification?.title || payload?.data?.title || 'P4NO';
        const body = payload?.notification?.body || payload?.data?.body || '';
        const url = payload?.data?.url || '/';
        toast(title, { description: body });
        // Also surface as a system notification (Facebook-style) so it appears
        // outside the page even when the tab is focused.
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
          navigator.serviceWorker
            .getRegistration('/firebase-cloud-messaging-push-scope')
            .then((reg) => {
              if (reg && Notification.permission === 'granted') {
                reg.showNotification(title, {
                  body,
                  icon: '/icons/icon-192x192.png',
                  badge: '/icons/icon-192x192.png',
                  tag: payload?.data?.tag || 'p4no',
                  data: { url, ...(payload?.data || {}) },
                });
              }
            })
            .catch(() => {});
        }
      });
      if (active) fgUnsubRef.current = unsub;
      else unsub();
    })();
    return () => {
      active = false;
      fgUnsubRef.current?.();
    };
  }, []);

  return { isSupported, isSubscribed, token, subscribe, unsubscribe };
};