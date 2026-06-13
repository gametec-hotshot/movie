/**
 * Prisma Service Worker v2.2
 *
 * Strategy:
 * - NAVIGATE requests (page loads): Network-First → fallback to cache.
 *   This is critical for iOS Safari/Chrome: returning a stale cached
 *   response for a navigate fetch after a SW controller change causes the
 *   "can't open this page" error. Always try the network first for page loads.
 *
 * - Static assets (logo, manifest): Cache-First → fallback to network.
 *   These never change at a given URL, so serving from cache is safe.
 *
 * - External resources (TMDb, fonts, streaming servers): Pass-through.
 *   Never intercepted — must always come fresh from the network.
 */

const CACHE_NAME = 'prisma-shell-v2.3';

const STATIC_ASSETS = [
  './logo.png',
  './manifest.json'
];

// On install: pre-cache only static assets (NOT index.html — see strategy above)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// On activate: delete old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept: external resources (TMDb, fonts, streaming servers, CDNs)
  const isExternal = (
    url.hostname !== self.location.hostname ||
    url.pathname.includes('advertisement.js')
  );

  if (isExternal) return;

  // ── STRATEGY 1: Network-First for navigation (page loads) ──────────────────
  // iOS Safari & Chrome require a real HTTP response for navigate-mode fetches.
  // Serving a cached page here after a SW update causes "can't open this page".
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline fallback: serve cached index.html if network is unavailable
        return caches.match('./index.html');
      })
    );
    return;
  }

  // ── STRATEGY 2: Cache-First for static assets ──────────────────────────────
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      // Not in cache — fetch from network and store for next time
      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
