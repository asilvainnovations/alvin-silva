/* A. Silva Innovations — offline-first service worker */
const VERSION = 'as-pwa-v1.2.0';
const CORE = [
  './',
  './index.html',
  './portfolio.html',
  './manifest.webmanifest',
  './assets/hero-banner.jpg',
  './assets/og-image.jpg',
  './assets/card-bird.jpg',
  './assets/ph-platform.jpg',
  './assets/ph-consulting.jpg',
  './assets/ph-publication.jpg',
  './assets/logo-32.png',
  './assets/logo-180.png',
  './assets/logo-192.png',
  './assets/logo-512.png',
  './assets/logo-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // HTML: network-first, fall back to cache (fresh content, offline resilient)
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Assets & fonts: cache-first, then network + cache
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
