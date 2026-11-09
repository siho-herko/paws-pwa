/**
 * sw.js — Woodland Restoration Calculator service worker
 * Pages are network-first so a deploy reaches returning users; static assets
 * are cache-first and refreshed by bumping CACHE_NAME.
 *
 * On the retired hostname paws-pwa.pages.dev this file only clears caches,
 * unregisters, and sends open windows to the new origin. Storage APIs other
 * than Cache Storage are left alone. Keep RETIRED_PAGES_HOST in sync with
 * retire-host.js (classic SW cannot import that ES module).
 */

const RETIRED_PAGES_HOST = 'paws-pwa.pages.dev';
const NEW_APP_ORIGIN = 'https://woodland-restoration.trigrammatic.com';

if (self.location.hostname === RETIRED_PAGES_HOST) {
  self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', event => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      await self.clients.claim();
      await self.registration.unregister();
      const windowClients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windowClients.map(client => {
        const url = new URL(client.url);
        return client.navigate(NEW_APP_ORIGIN + url.pathname + url.search + url.hash);
      }));
    })());
  });
} else {
  const CACHE_NAME  = 'paws-modeller-v15';

  const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/app.js?v=15',
    '/calc.js?v=15',
    '/charts.js?v=15',
    '/db.js?v=15',
    '/retire-host.js?v=15',
    '/styles/main.css?v=15',
    '/data/paws_constants.json',
    '/manifest.json',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon.png',
    '/images/funders/heritage-fund-stamp-gd-en.png',
    '/images/funders/scotgov-naturescot-lockup.png',
    '/fonts/source-sans-3-latin.woff2',
    '/fonts/source-sans-3-latin-ext.woff2',
    '/fonts/playfair-display-latin.woff2',
    '/fonts/playfair-display-latin-ext.woff2',
    '/fonts/jetbrains-mono-latin.woff2',
    '/fonts/jetbrains-mono-latin-ext.woff2',
  ];

  // ── Install: pre-cache all static assets ──────────

  self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(PRECACHE_URLS))
        .then(() => self.skipWaiting())
    );
  });

  // ── Activate: delete old cache versions ──────────

  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key  => caches.delete(key))
        ))
        .then(() => self.clients.claim())
    );
  });

  // ── Fetch: network-first for /data/ (rates must refresh), cache-first otherwise ──

  self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    if (event.request.mode === 'navigate' && url.origin === self.location.origin) {
      event.respondWith(
        fetch(event.request)
          .then(response => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put('/', clone));
            }
            return response;
          })
          .catch(() => caches.match('/'))
      );
      return;
    }

    if (url.origin === self.location.origin && url.pathname.startsWith('/data/')) {
      event.respondWith(
        fetch(event.request)
          .then(response => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => caches.match(event.request, { ignoreSearch: true }))
      );
      return;
    }

    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;

          return fetch(event.request).then(response => {
            // Cache successful responses for static files
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          });
        })
    );
  });
}
