const CACHE_NAME = 'asilva-v2';
const PRECACHE = [
  '/',
  '/index.html',
  '/portfolio.html',
  '/building-resilience.html',
  '/personal-resilience.html',
  '/margallo.html',
  '/margallo-2.html',
  '/policies.html',
  '/privacy-policy.html',
  '/cookie-policy.html',
  '/terms-of-services.html',
  '/accessibility-policy.html',
  '/manifest.webmanifest',
  '/assets/logo-32.png',
  '/assets/logo-192.png',
  '/assets/logo-512.png',
  '/assets/og-image.jpg',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(networkRes => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return networkRes;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
