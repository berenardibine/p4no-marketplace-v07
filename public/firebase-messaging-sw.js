// Firebase Cloud Messaging Service Worker
// Handles background push notifications for P4NO
/* eslint-disable */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAXaUAvTpO_9Zz04TmpzoaXSlIJAHS4Cq8',
  authDomain: 'p4no-a4bf1.firebaseapp.com',
  projectId: 'p4no-a4bf1',
  storageBucket: 'p4no-a4bf1.firebasestorage.app',
  messagingSenderId: '345462535475',
  appId: '1:345462535475:web:b4400f4db4f7e31b8e7a46',
});

const messaging = firebase.messaging();

// ── Telemetry to Supabase edge function ────────────────────────────────────
const SUPABASE_URL = 'https://tsrnmrnfmvsivnvdkqrj.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzcm5tcm5mbXZzaXZudmRrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDQ0MTUsImV4cCI6MjA4NjQ4MDQxNX0.oWOAbgjhZgcXkmetIQA0fwI_qq7LrZ-J74bKR8JDCQ8';

function track(event, queueId) {
  try {
    return fetch(`${SUPABASE_URL}/functions/v1/track-notification-event`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
      body: JSON.stringify({ event, queue_id: queueId || null }),
    }).catch(() => {});
  } catch (_) {}
}

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Background message:', payload);
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = notification.title || data.title || 'P4NO';
  const body = notification.body || data.body || '';
  const url = data.targetUrl || data.url || '/';
  const image = data.image || notification.image;
  const icon = data.icon || '/icons/icon-192x192.png';
  const badge = data.badge || '/icons/icon-192x192.png';
  const queueId = data.queue_id || null;

  self.registration.showNotification(title, {
    body,
    icon,
    badge,
    image,
    tag: data.tag || data.entity_id || 'p4no-notification',
    renotify: true,
    data: { url, queue_id: queueId, ...data },
    vibrate: [100, 50, 100],
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  });

  track('delivered', queueId);
});

// Click handler — open or focus correct P4NO page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.targetUrl || data.url || '/';
  const queueId = data.queue_id || null;
  const fullUrl = new URL(url, self.location.origin).href;

  if (event.action === 'dismiss') {
    event.waitUntil(track('dismissed', queueId));
    return;
  }

  event.waitUntil(
    Promise.all([
      track('clicked', queueId),
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            if ('focus' in client) {
              client.focus();
              if ('navigate' in client) client.navigate(fullUrl);
              return;
            }
          }
          return self.clients.openWindow(fullUrl);
        }),
    ])
  );
});

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  const queueId = data.queue_id || null;
  track('dismissed', queueId);
});
