/**
 * core/router.js — hash router for module-owned views.
 *
 * Static pages keep working exactly as they do; this only handles in-page
 * views that modules claim (`#/blog/some-post`). Kept deliberately small —
 * pattern matching with `:param` segments, a `*` catch-all, and nothing else.
 */
(function (root) {
  'use strict';

  const NS = (root.ASilva = root.ASilva || {});
  if (NS.router) return;
  const { bus } = NS.util;

  const routes = [];   // { pattern, regex, keys, owner, handler }

  function compile(pattern) {
    const keys = [];
    const regex = new RegExp('^' + pattern
      .replace(/\/$/, '')
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })
      .replace(/\*/g, '.*') + '/?$');
    return { regex, keys };
  }

  /** Claim a route. `owner` is a module id, used for diagnostics. */
  function claim(pattern, owner, handler) {
    const { regex, keys } = compile(pattern);
    routes.push({ pattern, regex, keys, owner, handler: handler || null });
    return () => {
      const i = routes.findIndex((r) => r.pattern === pattern && r.owner === owner);
      if (i > -1) routes.splice(i, 1);
    };
  }

  /** Attach a handler to an already-claimed pattern (registry claims first). */
  function on(pattern, handler) {
    const r = routes.find((x) => x.pattern === pattern);
    if (r) { r.handler = handler; return () => { r.handler = null; }; }
    return claim(pattern, 'inline', handler);
  }

  function current() {
    return (location.hash || '').replace(/^#/, '') || '/';
  }

  function resolve(path = current()) {
    for (const r of routes) {
      const m = r.regex.exec(path);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params, path };
    }
    return null;
  }

  function dispatch() {
    const hit = resolve();
    if (!hit) { bus.emit('router:nomatch', { path: current() }); return; }
    bus.emit('router:match', { path: hit.path, owner: hit.route.owner, params: hit.params });
    if (typeof hit.route.handler === 'function') {
      try { hit.route.handler(hit.params, hit.path); }
      catch (e) { console.error(`[router] handler for "${hit.route.pattern}" threw`, e); }
    }
  }

  function navigate(path, { replace = false } = {}) {
    const h = '#' + (path.startsWith('/') ? path : '/' + path);
    if (replace) history.replaceState(null, '', h);
    else location.hash = h;
    if (replace) dispatch();
  }

  function start() {
    window.addEventListener('hashchange', dispatch);
    dispatch();
  }

  NS.router = { claim, on, navigate, start, dispatch, resolve, current, routes };
})(window);
