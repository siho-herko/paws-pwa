/**
 * sw.js — PAWS Business Case Modeller Service Worker
 * Cache-first strategy for all static assets.
 */

const CACHE_NAME  = 'paws-modeller-v3';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/calc.js',
  '/charts.js',
  '/db.js',
  '/styles/main.css',
  '/data/paws_constants.json',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
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
