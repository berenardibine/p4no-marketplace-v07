import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { logActivity } from '@/lib/activityEvents';
import { trackWeeklyView } from './usePopularThisWeek';

const SUPABASE_URL = "https://tsrnmrnfmvsivnvdkqrj.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8";

// Generate or retrieve a persistent session ID for guests
const getSessionId = (): string => {
  const storageKey = 'smart_market_session_id';
  let sessionId = localStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
};

// Track impression timestamps to avoid duplicate calls
const getImpressionKey = (productId: string) => `impression_${productId}`;
const getViewKey = (productId: string) => `view_${productId}`;

const hasRecentImpression = (productId: string): boolean => {
  const key = getImpressionKey(productId);
  const timestamp = localStorage.getItem(key);
  if (!timestamp) return false;
  
  const hourAgo = Date.now() - (60 * 60 * 1000); // 1 hour in milliseconds
  return parseInt(timestamp) > hourAgo;
};

const hasRecentView = (productId: string): boolean => {
  const key = getViewKey(productId);
  const timestamp = localStorage.getItem(key);
  if (!timestamp) return false;
  
  const tenMinutesAgo = Date.now() - (10 * 60 * 1000); // 10 minutes in milliseconds
  return parseInt(timestamp) > tenMinutesAgo;
};

const markImpression = (productId: string) => {
  localStorage.setItem(getImpressionKey(productId), Date.now().toString());
};

const markView = (productId: string) => {
  localStorage.setItem(getViewKey(productId), Date.now().toString());
};

// Queue for batching impression calls
let impressionQueue: Array<{ productId: string; userId?: string; sessionId: string; refSource: string }> = [];
let viewQueue: Array<{ productId: string; userId?: string; sessionId: string; refSource: string }> = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

// Forensic finding: the homepage fired ONE edge-function request per visible
// card (24+ per view, 10+ per reload) and every one of them failed — the
// `record-impression` / `record-view` functions are not deployed on this
// project. Two fixes:
//   1. one batched request per flush instead of one per product
//   2. a circuit breaker: after a 404/network failure the endpoint is marked
//      unavailable for an hour, so a missing function can never produce a
//      per-card request storm again. Analytics still flows through the batched
//      `activity_events` pipeline.
const DISABLED_PREFIX = 'p4no_track_off:';
const DISABLE_TTL_MS = 60 * 60 * 1000;

const endpointDisabled = (fn: string): boolean => {
  try {
    const ts = Number(localStorage.getItem(DISABLED_PREFIX + fn) || 0);
    return ts > 0 && Date.now() - ts < DISABLE_TTL_MS;
  } catch { return false; }
};

const disableEndpoint = (fn: string) => {
  try { localStorage.setItem(DISABLED_PREFIX + fn, String(Date.now())); } catch { /* ignore */ }
};

type TrackItem = { productId: string; userId?: string; sessionId: string; refSource: string };

const sendBatch = async (fn: string, items: TrackItem[]) => {
  if (items.length === 0 || endpointDisabled(fn)) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      // `items` is the batch form; `...items[0]` keeps single-item back-compat.
      body: JSON.stringify({ items, ...items[0] }),
    });
    if (res.status === 404 || res.status === 501) disableEndpoint(fn);
  } catch {
    disableEndpoint(fn);
  }
};

const flushImpressionQueue = async () => {
  if (impressionQueue.length === 0) return;
  const batch = impressionQueue;
  impressionQueue = [];
  await sendBatch('record-impression', batch);
};

const flushViewQueue = async () => {
  if (viewQueue.length === 0) return;
  const batch = viewQueue;
  viewQueue = [];
  await sendBatch('record-view', batch);
};

const scheduleFlush = () => {
  if (flushTimeout) return;
  
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushImpressionQueue();
    flushViewQueue();
  }, 1000); // Debounce for 1 second
};

export const useProductTracking = () => {
  const { user } = useAuth();
  const sessionId = getSessionId();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const trackedElements = useRef<Map<string, Element>>(new Map());

  // Record an impression
  const recordImpression = useCallback((productId: string, refSource: string = 'home') => {
    if (hasRecentImpression(productId)) return;
    
    markImpression(productId);
    impressionQueue.push({
      productId,
      userId: user?.id,
      sessionId,
      refSource
    });
    scheduleFlush();
    logActivity({
      event_type: 'product_impression',
      entity_type: 'product',
      entity_id: productId,
      metadata: { ref_source: refSource },
      user_id: user?.id ?? null,
    });
  }, [user?.id, sessionId]);

  // Record a view
  const recordView = useCallback((productId: string, refSource: string = 'direct') => {
    if (hasRecentView(productId)) return;
    
    markView(productId);
    viewQueue.push({
      productId,
      userId: user?.id,
      sessionId,
      refSource
    });
    scheduleFlush();
    logActivity({
      event_type: 'product_view',
      entity_type: 'product',
      entity_id: productId,
      metadata: { ref_source: refSource },
      user_id: user?.id ?? null,
    });
  }, [user?.id, sessionId]);

  // Setup intersection observer for tracking impressions
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const productId = entry.target.getAttribute('data-product-id');
            const refSource = entry.target.getAttribute('data-ref-source') || 'home';
            
            if (productId) {
              recordImpression(productId, refSource);
            }
          }
        });
      },
      {
        threshold: 0.5, // At least 50% visible
        rootMargin: '0px'
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [recordImpression]);

  // Track an element for impression monitoring
  const trackElement = useCallback((element: Element | null, productId: string, refSource: string = 'home') => {
    if (!element || !observerRef.current) return;
    
    element.setAttribute('data-product-id', productId);
    element.setAttribute('data-ref-source', refSource);
    
    if (!trackedElements.current.has(productId)) {
      trackedElements.current.set(productId, element);
      observerRef.current.observe(element);
    }
  }, []);

  // Untrack an element
  const untrackElement = useCallback((productId: string) => {
    const element = trackedElements.current.get(productId);
    if (element && observerRef.current) {
      observerRef.current.unobserve(element);
      trackedElements.current.delete(productId);
    }
  }, []);

  return {
    recordImpression,
    recordView,
    trackElement,
    untrackElement,
    sessionId
  };
};

// Hook for tracking a single product view (used on product detail page)
export const useProductViewTracking = (productId: string | undefined, refSource: string = 'direct') => {
  const { recordView } = useProductTracking();
  const hasTracked = useRef(false);

  useEffect(() => {
    if (productId && !hasTracked.current) {
      hasTracked.current = true;
      recordView(productId, refSource);
      trackWeeklyView('product', productId);
    }
  }, [productId, recordView, refSource]);
};

// Component wrapper for tracking impressions via ref
export const useImpressionTracker = (productId: string, refSource: string = 'home') => {
  const { trackElement, untrackElement } = useProductTracking();
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (elementRef.current && productId) {
      trackElement(elementRef.current, productId, refSource);
    }

    return () => {
      if (productId) {
        untrackElement(productId);
      }
    };
  }, [productId, refSource, trackElement, untrackElement]);

  return elementRef;
};
