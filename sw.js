// Mio Tracker — Service Worker
// Adapted from Financial Tracker's sw.js.
// Network-first for HTML documents and all API calls (Google, Cloudflare Worker).
// Cache-first for static assets (manifest, icon, Chart.js — once added).

const CACHE = 'mio-tracker-v1';

const STATIC_ASSETS = [
  './manifest.json',
  './icon.svg'
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
  const url = e.request.url;

  // Always network-first: HTML documents and all API/auth calls.
  // This ensures app code and Drive data are never stale.
  if (
    e.request.destination === 'document' ||
    url.includes('accounts.google.com') ||
    url.includes('googleapis.com') ||
    url.includes('workers.dev') ||
    url.includes('gsi/client')
  ) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, libraries)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
