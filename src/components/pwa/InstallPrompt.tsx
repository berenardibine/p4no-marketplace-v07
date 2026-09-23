import { useState, useEffect, useCallback } from 'react';
import { X, Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALLED_KEY = 'sm-pwa-installed';
const DISMISSED_KEY = 'sm-install-dismissed';
const DISMISS_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours
const INITIAL_DELAY = 5000;

const isIOSDevice = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isInStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true;

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (window as any).__pwaInstallPrompt || null
  );
  const [showBanner, setShowBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const isIOS = isIOSDevice();

  useEffect(() => {
    if (isInStandaloneMode()) {
      setIsStandalone(true);
      return;
    }
    if (localStorage.getItem(INSTALLED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      (window as any).__pwaInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      // Show banner immediately when prompt becomes available
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      localStorage.setItem(INSTALLED_KEY, 'true');
      setShowBanner(false);
      setDeferredPrompt(null);
      (window as any).__pwaInstallPrompt = null;
    };
    window.addEventListener('appinstalled', installedHandler);

    // Auto-show banner after delay (for iOS or if prompt already captured)
    const autoShowTimer = setTimeout(() => {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      const canShow = !dismissed || Date.now() - parseInt(dismissed) >= DISMISS_COOLDOWN;
      if (canShow && (isIOS || (window as any).__pwaInstallPrompt)) {
        setShowBanner(true);
      }
    }, INITIAL_DELAY);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      clearTimeout(autoShowTimer);
    };
  }, []);

  // Re-show on focus after cooldown
  useEffect(() => {
    if (isStandalone || localStorage.getItem(INSTALLED_KEY)) return;

    const handleFocus = () => {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      const canShow = !dismissed || Date.now() - parseInt(dismissed) >= DISMISS_COOLDOWN;
      if (canShow && (isIOS || deferredPrompt || (window as any).__pwaInstallPrompt)) {
        if ((window as any).__pwaInstallPrompt && !deferredPrompt) {
          setDeferredPrompt((window as any).__pwaInstallPrompt);
        }
        setShowBanner(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    const visHandler = () => {
      if (document.visibilityState === 'visible') handleFocus();
    };
    document.addEventListener('visibilitychange', visHandler);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, [isStandalone, deferredPrompt]);

  const handleInstall = useCallback(async () => {
    // Re-check global in case it was set after render
    const prompt = deferredPrompt || (window as any).__pwaInstallPrompt as BeforeInstallPromptEvent | null;

    if (prompt) {
      try {
        // Trigger native browser install dialog — NO instructions shown
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          localStorage.setItem(INSTALLED_KEY, 'true');
        } else {
          localStorage.setItem(DISMISSED_KEY, Date.now().toString());
        }
      } catch (err) {
        console.warn('[PWA] Install prompt error:', err);
      }
      setDeferredPrompt(null);
      (window as any).__pwaInstallPrompt = null;
      setShowBanner(false);
      return;
    }

    // iOS: no install API exists, just dismiss — user already sees "Add to Home Screen" in Safari
    handleDismiss();
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  if (isStandalone || !showBanner) return null;

  return (
    <div className={cn(
      "fixed bottom-20 left-4 right-4 z-50",
      "bg-card border border-border rounded-2xl p-4 shadow-elevated",
      "animate-slide-up"
    )}>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
          <img src="/favicon.ico" alt="p4no" className="w-10 h-10 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground">Install P4no hub</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isIOS
              ? 'Tap the Share button below, then "Add to Home Screen"'
              : 'Get instant product alerts & offers — fast, offline, no browser!'}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={handleDismiss} className="flex-1 text-xs">
          Not now
        </Button>
        <Button size="sm" onClick={handleInstall} className="flex-1 text-xs gap-1">
          {isIOS ? (
            <>
              <Share className="h-3.5 w-3.5" />
              Got it
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              Install App
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default InstallPrompt;
