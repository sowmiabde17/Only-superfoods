/**
 * public/sw.js — Only Superfoods PWA Service Worker
 * Strategy:
 * - Never cache or intercept on localhost / 127.0.0.1 (auto-unregister to keep Vite HMR & dev modules clean).
 * - In production HTTPS:
 *   - Network-first for HTML navigation pages so inventory & prices stay live.
 *   - Cache-first only for immutable hashed /_astro/ bundles and static images/icons/fonts.
 */

const CACHE_NAME = 'osf-cache-v3';
const IS_LOCALHOST =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

const PRECACHE_ASSETS = [
  '/manifest.webmanifest',
  '/logo.png',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  if (IS_LOCALHOST) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[PWA SW] Pre-cache skipped items:', err))
  );
});

self.addEventListener('activate', (event) => {
  if (IS_LOCALHOST) {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
    return;
  }

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (IS_LOCALHOST) return;

  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Never intercept Vite dev URLs, admin routes, or Supabase API calls
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/admin')
  ) {
    return;
  }

  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.gstatic.com')) {
    return;
  }

  // Navigation requests (HTML pages) -> Network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/');
        })
    );
    return;
  }

  // Hashed build bundles & static media -> Cache first with background refresh
  if (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/icons/') ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
  }
});
