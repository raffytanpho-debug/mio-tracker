// Mio Tracker — Service Worker
// Adapted from Financial Tracker's sw.js.
// Network-first for HTML documents and all API calls (Google, Cloudflare Worker).
// Cache-first for static assets (manifest, icon, Chart.js — once added).

const CACHE = 'mio-tracker-v8';

const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon-180.png'
  // Chart.js will be added here in Phase 5 when growth charts are built
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = req.url;

  // App shell (HTML documents): stale-while-revalidate. Serve the cached shell
  // instantly (no network wait), then refresh the cache in the background for the
  // next launch. Falls back to cache when offline. This fixes the 20-30s blank
  // screen on slow mobile networks where the old network-first wait blocked paint.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match('./index.html').then(cached => {
          const network = fetch(req).then(res => {
            if (res && res.ok) cache.put('./index.html', res.clone());
            return res;
          }).catch(() => cached || cache.match('./'));
          return cached || network;
        })
      )
    );
    return;
  }

  // API / auth calls: always go to the network, never serve stale Drive data.
  if (
    url.includes('accounts.google.com') ||
    url.includes('googleapis.com') ||
    url.includes('workers.dev') ||
    url.includes('gsi/client')
  ) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Cache-first for static assets (icons, manifest, libraries)
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          e.waitUntil(caches.open(CACHE).then(c => c.put(req, clone)));
        }
        return res;
      });
    })
  );
});
