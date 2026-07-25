import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoadingState } from '@/context/LoadingContext';

/**
 * Global splash overlay.
 * Shows on route changes AND while any global loader token is active.
 * Hides only when (route is idle/painted) AND (no active loaders).
 * MIN_DURATION prevents flashing; MAX_DURATION is a safety cap.
 */
const MIN_DURATION = 350;
const MAX_DURATION = 8000;

const PageTransitionSplash = () => {
  const location = useLocation();
  const { isActive, currentLabel } = useLoadingState();
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('Loading…');
  const firstRender = useRef(true);
  const startedAt = useRef<number>(0);
  const hardCapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeReadyRef = useRef(true);

  // Show on route change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    routeReadyRef.current = false;
    setVisible(true);
    setLabel('Preparing Experience…');
    startedAt.current = Date.now();
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (hardCapRef.current) clearTimeout(hardCapRef.current);
    hardCapRef.current = setTimeout(() => {
      routeReadyRef.current = true;
      maybeHide();
    }, MAX_DURATION);

    const markReady = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        routeReadyRef.current = true;
        maybeHide();
      }));
    };
    const ric: any = (window as any).requestIdleCallback;
    if (typeof ric === 'function') ric(markReady, { timeout: MAX_DURATION });
    else if (document.readyState === 'complete') markReady();
    else window.addEventListener('load', markReady, { once: true });

    return () => {
      if (hardCapRef.current) clearTimeout(hardCapRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Show whenever any global loader is active.
  useEffect(() => {
    if (isActive) {
      setVisible(true);
      setLabel(currentLabel);
      if (!startedAt.current) startedAt.current = Date.now();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      maybeHide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentLabel]);

  function maybeHide() {
    if (isActive) return;
    if (!routeReadyRef.current) return;
    const elapsed = Date.now() - startedAt.current;
    const remaining = Math.max(0, MIN_DURATION - elapsed);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      startedAt.current = 0;
    }, remaining);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center pointer-events-none backdrop-blur-md"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(24 95% 45%) 50%, hsl(0 84% 50%) 100%)',
        animation: 'p4noTransitionFadeIn 220ms ease-out forwards',
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <div
        style={{ animation: 'p4noTransitionPop 500ms cubic-bezier(0.16,1,0.3,1) forwards' }}
        className="flex flex-col items-center"
      >
        <img
          src="/logo-v2.png"
          alt=""
          className="w-20 h-20 rounded-[22px] shadow-2xl object-contain"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        />
        <div className="mt-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/90 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-white/90 animate-bounce" style={{ animationDelay: '120ms' }} />
          <span className="w-2 h-2 rounded-full bg-white/90 animate-bounce" style={{ animationDelay: '240ms' }} />
        </div>
        <p className="mt-3 text-white text-sm font-semibold tracking-wide">{label}</p>
      </div>
      <style>{`
        @keyframes p4noTransitionFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes p4noTransitionPop {
          0% { opacity: 0; transform: scale(0.7) }
          40% { opacity: 1; transform: scale(1.05) }
          100% { opacity: 1; transform: scale(1) }
        }
      `}</style>
    </div>
  );
};

export default PageTransitionSplash;
