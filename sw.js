/**
 * sw.js — offline shell for the Alvin Silva platform.
 *
 * Bump CACHE_VERSION on any deploy that changes a precached file.
 *
 * Strategy
 *   navigations   network-first, fall back to the cached page, then /index.html
 *   same-origin   stale-while-revalidate (GET only)
 *   cross-origin  untouched (fonts, Supabase, analytics go straight to network)
 *
 * Precaching is per-file (allSettled) so one missing path can never
 * abort installation — the failure mode that left earlier versions
 * without any offline support. tools/validate-shell.py checks that
 * every PRECACHE entry exists on disk.
 */
const CACHE_VERSION = 'asilva-v9-shell';
const PRECACHE = [
  '/',
  '/index.html',
  '/portfolio.html',
  '/blog.html',
  '/chat.html',
  '/chorus.html',
  '/career-automation.html',
  '/building-resilience.html',
  '/personal-resilience.html',
  '/apm-ldi.html',
  '/support.html',
  '/policies.html',
  '/privacy-policy.html',
  '/cookie-policy.html',
  '/terms-of-services.html',
  '/accessibility-policy.html',
  '/404.html',
  '/style.css',
  '/assets/css/core.css',
  '/assets/css/components.css',
  '/assets/css/visualizations.css',
  '/assets/css/app-shell.css',
  '/assets/js/boot.js',
  '/assets/js/core/app-shell.js',
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
  '/assets/logo-180.png',
  '/assets/logo-192.png',
  '/assets/logo-512.png',
  '/assets/logo-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const results = await Promise.allSettled(PRECACHE.map(async (path) => {
      const res = await fetch(new Request(path, { cache: 'reload' }));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await cache.put(path, await clean(res));
    }));
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.warn('[sw] precache miss:', PRECACHE[i], r.reason);
    });
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

/* Vercel cleanUrls redirects /page.html -> /page. A redirected response
   cannot be served to a navigation, so store a fresh copy of its body. */
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

/* /portfolio (clean URL) and /portfolio.html are the same page. */
async function matchPage(cache, request) {
  const url = new URL(request.url);
  const tries = [request, url.pathname, url.pathname.replace(/\/$/, '') + '.html', url.pathname + '/index.html'];
  for (const t of tries) {
    const hit = await cache.match(t, { ignoreSearch: true });
    if (hit) return hit;
  }
  return null;
}

async function fromNetworkThenCache(event) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const preload = await event.preloadResponse;
    const res = preload || await fetch(event.request);
    if (res && res.ok) cache.put(event.request, await clean(res.clone()));
    return res;
  } catch (_) {
    return (await matchPage(cache, event.request)) ||
      (await cache.match('/index.html')) ||
      new Response('You are offline and this page is not saved yet.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(event.request);
  const network = fetch(event.request).then((res) => {
    if (res && res.ok && res.type === 'basic') cache.put(event.request, res.clone());
    return res;
  }).catch(() => cached);
  if (cached) { event.waitUntil(network); return cached; }
  return network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') { event.respondWith(fromNetworkThenCache(event)); return; }
  event.respondWith(staleWhileRevalidate(event));
});
