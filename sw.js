// VERSION BUMP (audit 2026-08-04): CACHE_NAME had stayed 'asilva-v2' since
// introduction despite ongoing content edits to precached pages. The fetch
// handler below returns the cached response immediately whenever one
// exists and only refreshes the cache in the background for the *next*
// load — so without a version bump, repeat visitors can be stuck one (or
// more) deploys behind indefinitely. Bump this string on any deploy that
// changes a precached file, to force activate() to clear the old cache.
const CACHE_NAME = 'asilva-v7';
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
  // Added (audit 2026-08-21): 15 pages <link> this stylesheet but it was
  // never precached, so offline loads rendered unstyled.
  '/style.css',
  // Added (audit 2026-08-21): platform module tree + new surfaces. The chat
  // engine is now fully client-side, so precaching these makes the assistant
  // work offline — previously impossible when it depended on a remote API.
  '/blog.html',
  '/chorus.html',
  '/404.html',
  '/assets/js/boot.js',
  '/assets/js/core/util.js',
  '/assets/js/core/nlp.js',
  '/assets/js/core/data.js',
  '/assets/js/core/registry.js',
  '/assets/js/core/router.js',
  '/assets/js/chat/engine.js',
  '/assets/js/chat/widget.js',
  '/assets/js/modules/blog.js',
  '/assets/js/modules/ai-chorus.js',
  '/assets/data/kb.json',
  '/assets/data/blog/index.json',
  '/credentials.json',
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
