// Smart prefetch
// --------------
// Warms the static JSON a user is *likely* to open next — nothing more.
//   • Product cards warm their detail JSON when they scroll into view.
//   • Pointer-intent (hover / touchstart) promotes a card to the front.
//   • Everything runs on requestIdleCallback with a small concurrency cap so
//     prefetch never competes with the visible render.
//
// Prefetch only ever touches the CDN/static layer — never PostgREST.

import { warmContent, isWarm } from './cdnGuard';
import { productStaticPath } from './productShard';
import { recordPrefetch } from './trafficTelemetry';

const MAX_CONCURRENT = 2;
const MAX_QUEUE = 24;

const queued = new Set<string>();
const done = new Set<string>();
const queue: string[] = [];
let running = 0;

type IdleFn = (cb: () => void) => void;
const idle: IdleFn =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 1500 })
    : (cb) => setTimeout(cb, 200);

function pump() {
  if (running >= MAX_CONCURRENT) return;
  const path = queue.shift();
  if (!path) return;
  queued.delete(path);
  running += 1;
  idle(() => {
    void warmContent(path)
      .then(() => {
        done.add(path);
        recordPrefetch(false);
      })
      .finally(() => {
        running -= 1;
        pump();
      });
  });
}

/** Queue a static path for idle-time warming. */
export function prefetchPath(path: string, priority = false): void {
  if (typeof window === 'undefined') return;
  if (!path || done.has(path) || queued.has(path) || isWarm(path)) return;
  if (queue.length >= MAX_QUEUE) queue.pop();
  queued.add(path);
  if (priority) queue.unshift(path);
  else queue.push(path);
  pump();
}

/** Queue a product detail payload (sharded path resolved locally). */
export async function prefetchProduct(key: string, priority = false): Promise<void> {
  if (!key) return;
  prefetchPath(await productStaticPath(key), priority);
}

export function prefetchService(slug: string, priority = false): void {
  prefetchPath(`service/${slug}`, priority);
}

export function prefetchArticle(slug: string, priority = false): void {
  prefetchPath(`article/${slug}`, priority);
}

export function prefetchCategory(slug: string, priority = false): void {
  prefetchPath(`products/category/${slug}`, priority);
}

export function prefetchSeller(key: string, priority = false): void {
  prefetchPath(`sellers/${key}`, priority);
}

/** Called when a prefetched payload actually got used (hit-rate accounting). */
export function notePrefetchHit(path: string): void {
  if (done.has(path)) recordPrefetch(true);
}

export function getPrefetchState() {
  return { queued: queue.length, running, warmed: done.size };
}
