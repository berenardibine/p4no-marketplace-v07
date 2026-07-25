import { useEffect, useState } from 'react';

const KEY_PRODUCT = 'p4no-eng-products';
const KEY_ARTICLE = 'p4no-eng-articles';
const KEY_VISITS = 'p4no-eng-visits';
const KEY_VISIT_DATE = 'p4no-eng-last-visit-date';
const KEY_DISMISSED = 'p4no-push-dismissed-at';
const KEY_DENIED = 'p4no-push-denied-at';
const KEY_PROMPTED = 'p4no-push-prompted';
const SESSION_KEY_PATH = 'p4no-eng-last-path';
const SESSION_KEY_VISIT = 'p4no-eng-visit-counted';

const PRODUCT_THRESHOLD = 3;
const ARTICLE_THRESHOLD = 2;
const VISIT_THRESHOLD = 2;
const TIME_THRESHOLD_MS = 60_000;
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DENIED_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function inc(key: string) {
  const n = Number(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(n));
  return n;
}
function get(key: string) {
  return Number(localStorage.getItem(key) || '0');
}

function classify(path: string): 'product' | 'article' | null {
  if (/^\/(product|products|p)\//.test(path)) return 'product';
  if (/^\/insights\/article\//.test(path)) return 'article';
  return null;
}

function countVisitOnce() {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(SESSION_KEY_VISIT) === '1') return;
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem(KEY_VISIT_DATE);
  if (last !== today) {
    inc(KEY_VISITS);
    localStorage.setItem(KEY_VISIT_DATE, today);
  }
  sessionStorage.setItem(SESSION_KEY_VISIT, '1');
}

/**
 * Returns true once the user has engaged enough AND notifications are still pending.
 * Triggers: 60s on site OR 3 products OR 2 articles OR 2nd+ visit.
 */
export function useEngagementTrigger(enabled: boolean): boolean {
  const [shouldPrompt, setShouldPrompt] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(KEY_PROMPTED) === '1') return;

    const dismissedAt = Number(localStorage.getItem(KEY_DISMISSED) || '0');
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;
    const deniedAt = Number(localStorage.getItem(KEY_DENIED) || '0');
    if (deniedAt && Date.now() - deniedAt < DENIED_COOLDOWN_MS) return;

    countVisitOnce();

    const evaluate = () => {
      if (
        get(KEY_PRODUCT) >= PRODUCT_THRESHOLD ||
        get(KEY_ARTICLE) >= ARTICLE_THRESHOLD ||
        get(KEY_VISITS) >= VISIT_THRESHOLD
      ) {
        setShouldPrompt(true);
        return true;
      }
      return false;
    };

    const tick = () => {
      const path = window.location.pathname;
      const last = sessionStorage.getItem(SESSION_KEY_PATH);
      if (last === path) return;
      sessionStorage.setItem(SESSION_KEY_PATH, path);
      const kind = classify(path);
      if (kind === 'product') inc(KEY_PRODUCT);
      else if (kind === 'article') inc(KEY_ARTICLE);
      evaluate();
    };
    tick();

    const onPop = () => setTimeout(tick, 0);
    window.addEventListener('popstate', onPop);

    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (...args) {
      const r = origPush.apply(this, args as any);
      setTimeout(tick, 0);
      return r;
    } as any;
    history.replaceState = function (...args) {
      const r = origReplace.apply(this, args as any);
      setTimeout(tick, 0);
      return r;
    } as any;

    const timer = window.setTimeout(() => {
      if (!evaluate()) setShouldPrompt(true);
    }, TIME_THRESHOLD_MS);

    return () => {
      window.removeEventListener('popstate', onPop);
      history.pushState = origPush;
      history.replaceState = origReplace;
      clearTimeout(timer);
    };
  }, [enabled]);

  return shouldPrompt;
}

export function markPushPrompted() {
  localStorage.setItem(KEY_PROMPTED, '1');
}
export function markPushDismissed() {
  localStorage.setItem(KEY_DISMISSED, String(Date.now()));
}
export function markPushDenied() {
  localStorage.setItem(KEY_DENIED, String(Date.now()));
}
