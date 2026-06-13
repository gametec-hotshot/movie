/**
 * Prisma Service Worker
 * - Caches the app shell (index.html, logo.png, manifest.json) on install.
 * - Serves shell from cache for instant loads.
 * - NEVER caches API calls (TMDb, streaming servers) — those must always be fresh.
 */

const CACHE_NAME = 'prisma-shell-v2.0';

const APP_SHELL = [
  './',
  './index.html',
  './logo.png',
  './manifest.json'
];

// On install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
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

// On fetch: Network-first for everything except external resources
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept: TMDb API, streaming servers, external resources
  const isExternal = (
    url.hostname.includes('themoviedb.org') ||
    url.hostname.includes('image.tmdb.org') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('youtube.com') ||
    url.pathname.includes('advertisement.js') ||
    !url.hostname.includes(self.location.hostname)
  );

  if (isExternal) return;

  // Stale-While-Revalidate Strategy for App Shell
  // Ensures instant loading from cache, while silently updating the cache in the background.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // If network fails and we have no cache, fallback to offline shell
        if (!cachedResponse && event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });

      // Return cached response instantly if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
