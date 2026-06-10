// Mio Tracker — Service Worker
// Adapted from Financial Tracker's sw.js.
// Network-first for HTML documents and all API calls (Google, Cloudflare Worker).
// Cache-first for static assets (manifest, icon, Chart.js — once added).

const CACHE = 'mio-tracker-v5';

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

  // App shell (HTML documents): network-first so app code is never stale when
  // online, but cache each successful response and fall back to that cached
  // shell when the network fails — instead of a browser error page. This is the
  // fix for "the app won't load" on flaky networks.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put('./index.html', clone)));
        return res;
      }).catch(() =>
        caches.match('./index.html').then(c => c || caches.match('./'))
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
