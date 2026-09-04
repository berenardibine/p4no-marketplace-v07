/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// ═══════════════════════════════════════════
// 1. PRECACHE STATIC ASSETS (injected by workbox)
// ═══════════════════════════════════════════
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ═══════════════════════════════════════════
// 2. NAVIGATION FALLBACK (offline page)
// ═══════════════════════════════════════════
const navigationHandler = new NetworkFirst({
  cacheName: 'navigations',
  // Never let a cached shell win on a working network; only fall back offline.
  networkTimeoutSeconds: 5,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
  ],
});

// Fallback to offline.html when navigation fails
const navigationRoute = new NavigationRoute(navigationHandler, {
  // Don't handle auth callback URLs
  denylist: [/\/auth/, /\/reset-password/],
});
registerRoute(navigationRoute);

// ═══════════════════════════════════════════
// 3. RUNTIME CACHING STRATEGIES
// ═══════════════════════════════════════════

// Cache Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Cache Supabase API responses (products, categories, etc.)
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co') && url.pathname.startsWith('/rest/'),
  new NetworkFirst({
    cacheName: 'supabase-api',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 2 }), // 2 hours
    ],
  })
);

// Cache product images from Supabase Storage
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co') && url.pathname.includes('/storage/'),
  new CacheFirst({
    cacheName: 'product-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }), // 30 days
    ],
  })
);

// Cache other images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// Cache JS/CSS assets
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
  })
);

// ═══════════════════════════════════════════
// 4. PUSH NOTIFICATIONS
// ═══════════════════════════════════════════
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data: { title: string; body: string; icon?: string; badge?: string; url?: string; tag?: string };
  try {
    data = event.data.json();
  } catch {
    data = { title: 'p4no', body: event.data.text() };
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'smart-market-notification',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options as any));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          (client as WindowClient).navigate(url);
          return;
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});

// ═══════════════════════════════════════════
// 5. BACKGROUND SYNC (offline actions)
// ═══════════════════════════════════════════
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  // Placeholder for syncing queued offline actions
  console.log('[SW] Background sync triggered');
}

// ═══════════════════════════════════════════
// 6. SKIP WAITING & CLAIM CLIENTS
// ═══════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// A new build must not wait for every tab to close, otherwise users stay trapped
// on an old bundle/HTML combination.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
