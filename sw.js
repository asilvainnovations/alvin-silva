// VERSION BUMP (audit 2026-08-04): CACHE_NAME had stayed 'asilva-v2' since
// introduction despite ongoing content edits to precached pages. The fetch
// handler below returns the cached response immediately whenever one
// exists and only refreshes the cache in the background for the *next*
// load — so without a version bump, repeat visitors can be stuck one (or
// more) deploys behind indefinitely. Bump this string on any deploy that
// changes a precached file, to force activate() to clear the old cache.
const CACHE_NAME = 'asilva-v3';
const PRECACHE = [
  '/',
  '/index.html',
  '/portfolio.html',
  '/building-resilience.html',
  '/personal-resilience.html',
  '/policies.html',
  '/privacy-policy.html',
  '/cookie-policy.html',
  '/terms-of-services.html',
  '/accessibility-policy.html',
  // Added (audit 2026-08-04): these two tools previously never registered
  // the service worker and were absent from precache, so they had zero
  // offline support even though they're core to the career-ops workflow.
  '/career-automation.html',
  '/chat.html',
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
