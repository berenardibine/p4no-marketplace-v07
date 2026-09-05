import { useCallback, useRef } from 'react';

/**
 * PUBLIC VIEW / IMPRESSION TRACKING IS PERMANENTLY DISABLED.
 *
 * Normal public browsing must not produce any database write, edge-function
 * call or analytics request. These exports remain as inert no-ops so existing
 * call sites keep working without any network activity. Do not reintroduce
 * queues, batching, IntersectionObservers or background flushing here.
 */

const getSessionId = (): string => {
  const storageKey = 'smart_market_session_id';
  try {
    let sessionId = localStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(storageKey, sessionId);
    }
    return sessionId;
  } catch {
    return 'anonymous';
  }
};

export const useProductTracking = () => {
  const noop = useCallback((..._args: unknown[]) => {}, []);
  return {
    recordImpression: noop,
    recordView: noop,
    trackElement: noop,
    untrackElement: noop,
    sessionId: getSessionId(),
  };
};

export const useProductViewTracking = (_productId?: string, _refSource?: string) => {};

export const useImpressionTracker = (_productId?: string, _refSource?: string) => {
  return useRef<HTMLDivElement>(null);
};
