import { useEffect, useCallback, useState } from 'react';
import { useGeo } from '@/context/GeoContext';
import { Button } from '@/components/ui/button';
import { Bell, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { requestFcmToken, detectBrowser, detectDeviceType } from '@/lib/firebase';
import { supabase } from '@/integrations/supabase/client';

const PERMISSIONS_KEY = 'sm-permissions';
const NOTIF_REPROMPT_KEY = 'sm-notif-reprompt';
const LOCATION_REPROMPT_KEY = 'sm-loc-reprompt';
const REPROMPT_DELAY = 4 * 60 * 60 * 1000; // 4 hours (aggressive like WhatsApp)

interface StoredPermissions {
  location: PermissionState | null;
  notifications: NotificationPermission | null;
  timestamp: number;
}

const PermissionHandler = () => {
  const { requestLocationPermission } = useGeo();
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [showLocationBanner, setShowLocationBanner] = useState(false);

  const getStoredPermissions = (): StoredPermissions | null => {
    try {
      const stored = localStorage.getItem(PERMISSIONS_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const storePermissions = (perms: Partial<StoredPermissions>) => {
    const existing = getStoredPermissions();
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify({
      ...existing,
      ...perms,
      timestamp: Date.now(),
    }));
  };

  // Register an FCM token for this device and persist it to push_subscriptions.
  // Safe to call multiple times — upsert is keyed on fcm_token.
  const registerFcmToken = useCallback(async () => {
    try {
      const token = await requestFcmToken();
      if (!token) return;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: user?.id || null,
          fcm_token: token,
          browser: detectBrowser(),
          device_type: detectDeviceType(),
          is_active: true,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'fcm_token' }
      );
    } catch (e) {
      console.warn('[PermissionHandler] FCM registration failed:', e);
    }
  }, []);

  const canReprompt = (key: string) => {
    const last = localStorage.getItem(key);
    if (!last) return true;
    return Date.now() - parseInt(last) >= REPROMPT_DELAY;
  };

  // ── Notification Permission ──
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return;

    const current = Notification.permission;
    if (current === 'granted') {
      storePermissions({ notifications: 'granted' });
      setShowNotifBanner(false);
      // Ensure FCM token exists for this device even if permission was granted earlier
      void registerFcmToken();
      return;
    }

    // If denied at browser level, show in-app banner to guide user
    if (current === 'denied') {
      storePermissions({ notifications: 'denied' });
      if (canReprompt(NOTIF_REPROMPT_KEY)) {
        setShowNotifBanner(true);
      }
      return;
    }

    // Permission is 'default' — can prompt
    if (!canReprompt(NOTIF_REPROMPT_KEY)) return;

    try {
      const result = await Notification.requestPermission();
      storePermissions({ notifications: result });
      if (result === 'granted') {
        setShowNotifBanner(false);
        void registerFcmToken();
      } else {
        localStorage.setItem(NOTIF_REPROMPT_KEY, Date.now().toString());
        setShowNotifBanner(true);
      }
    } catch (err) {
      console.error('[PermissionHandler] Notification request failed:', err);
    }
  }, []);

  // ── Location Permission ──
  const requestLocationPermissionWrapped = useCallback(async () => {
    if (!canReprompt(LOCATION_REPROMPT_KEY)) {
      // Show banner if previously denied
      const stored = getStoredPermissions();
      if (stored?.location === 'denied') {
        setShowLocationBanner(true);
      }
      return;
    }

    try {
      await requestLocationPermission();
      storePermissions({ location: 'granted' });
      setShowLocationBanner(false);
    } catch {
      storePermissions({ location: 'denied' });
      localStorage.setItem(LOCATION_REPROMPT_KEY, Date.now().toString());
      setShowLocationBanner(true);
    }
  }, [requestLocationPermission]);

  // ── Initial request on mount ──
  useEffect(() => {
    const timer = setTimeout(() => {
      requestLocationPermissionWrapped();
      setTimeout(() => requestNotificationPermission(), 1500);
    }, 2000);
    return () => clearTimeout(timer);
  }, [requestLocationPermissionWrapped, requestNotificationPermission]);

  // ── Re-check on every return/focus (like Facebook) ──
  useEffect(() => {
    const handleFocus = () => {
      const stored = getStoredPermissions();

      // Re-ask notification if not granted
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted' && canReprompt(NOTIF_REPROMPT_KEY)) {
        requestNotificationPermission();
      }

      // Re-ask location if not granted  
      if (stored?.location !== 'granted' && canReprompt(LOCATION_REPROMPT_KEY)) {
        requestLocationPermissionWrapped();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleFocus();
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [requestNotificationPermission, requestLocationPermissionWrapped]);

  const dismissNotifBanner = () => {
    setShowNotifBanner(false);
    localStorage.setItem(NOTIF_REPROMPT_KEY, Date.now().toString());
  };

  const dismissLocationBanner = () => {
    setShowLocationBanner(false);
    localStorage.setItem(LOCATION_REPROMPT_KEY, Date.now().toString());
  };

  const handleEnableNotifications = async () => {
    if (Notification.permission === 'denied') {
      // Can't re-prompt programmatically, guide user
      alert('Notifications are blocked. Please enable them in your browser settings:\n\n1. Click the lock icon in the address bar\n2. Find "Notifications"\n3. Change to "Allow"');
      dismissNotifBanner();
      return;
    }
    await requestNotificationPermission();
  };

  const handleEnableLocation = async () => {
    try {
      await requestLocationPermission();
      storePermissions({ location: 'granted' });
      setShowLocationBanner(false);
    } catch {
      alert('Location is blocked. Please enable it in your browser settings:\n\n1. Click the lock icon in the address bar\n2. Find "Location"\n3. Change to "Allow"');
      dismissLocationBanner();
    }
  };

  return (
    <>
      {/* Notification Permission Banner */}
      {showNotifBanner && (
        <div className={cn(
          "fixed top-0 left-0 right-0 z-[60] safe-top",
          "bg-primary text-primary-foreground px-4 py-3 shadow-lg",
          "animate-slide-down flex items-center gap-3"
        )}>
          <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Enable Notifications</p>
            <p className="text-xs opacity-90">Get instant alerts for deals, orders & new products near you</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleEnableNotifications}
            className="shrink-0 text-xs font-semibold"
          >
            Enable
          </Button>
          <button onClick={dismissNotifBanner} className="p-1 shrink-0 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Location Permission Banner */}
      {showLocationBanner && !showNotifBanner && (
        <div className={cn(
          "fixed top-0 left-0 right-0 z-[60] safe-top",
          "bg-accent text-accent-foreground px-4 py-3 shadow-lg",
          "animate-slide-down flex items-center gap-3"
        )}>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Enable Location</p>
            <p className="text-xs text-muted-foreground">See products & shops near you</p>
          </div>
          <Button
            size="sm"
            onClick={handleEnableLocation}
            className="shrink-0 text-xs font-semibold"
          >
            Enable
          </Button>
          <button onClick={dismissLocationBanner} className="p-1 shrink-0 opacity-70 hover:opacity-100">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}
    </>
  );
};

export default PermissionHandler;
