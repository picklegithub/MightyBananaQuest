// Life Admin — Service Worker
// Cache-first for local assets, network-first for CDN resources.

const CACHE = 'life-admin-v1';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './styles/tokens.css',
  './app/shared.jsx',
  './app/screens-1.jsx',
  './app/screens-2.jsx',
  './app/screens-3.jsx',
  './app/screens-4.jsx',
  './app/desktop.jsx',
  './frames/android-frame.jsx',
  './frames/browser-window.jsx',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json',
];

const CDN_ASSETS = [
  'https://unpkg.com/react@18.3.1/umd/react.development.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap',
];

// ── Install: precache local assets ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      // Cache local assets (must all succeed)
      return cache.addAll(LOCAL_ASSETS).then(() => {
        // Cache CDN assets individually — failures are non-fatal
        return Promise.allSettled(
          CDN_ASSETS.map((url) =>
            fetch(url, { mode: 'cors' })
              .then((res) => { if (res.ok) cache.put(url, res); })
              .catch(() => {})
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for local, network-first for CDN ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isCDN = CDN_ASSETS.some((u) => event.request.url.startsWith(u.split('?')[0]));
  const isLocal = url.origin === self.location.origin;

  if (isLocal) {
    // Cache-first
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
          return res;
        })
      )
    );
  } else if (isCDN) {
    // Network-first with cache fallback
    event.respondWith(
      fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request))
    );
  }
  // All other requests: let browser handle normally
});
