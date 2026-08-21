/**
 * core/registry.js — the extension point.
 *
 * Every feature beyond the static pages registers itself here instead of
 * hardcoding a <script> into each HTML file. A module declares what it needs
 * and where it mounts; the registry handles ordering, dependency resolution,
 * lazy activation, and failure isolation.
 *
 * Adding a feature (blog, AI-Chorus, anything after) is then three steps:
 *   1. write assets/js/modules/<name>.js
 *   2. call ASilva.registry.define({...}) at the bottom of it
 *   3. add the file to MODULES in assets/js/boot.js
 *
 * No other file needs to change. That is the whole point.
 *
 * A module descriptor:
 * {
 *   id:       'blog',                     // unique
 *   version:  '1.0.0',
 *   requires: ['data'],                   // other module ids or core services
 *   mount:    '[data-asilva-blog]',       // CSS selector, or null for headless
 *   routes:   ['#/blog', '#/blog/:slug'], // optional, claimed on the hash router
 *   nav:      { label: 'Writing', href: 'blog.html', order: 40 }, // optional
 *   setup(ctx) { ... }                    // async; ctx = { data, util, nlp, el, mountEl }
 * }
 */
(function (root) {
  'use strict';

  const NS = (root.ASilva = root.ASilva || {});
  if (NS.registry) return;
  const { bus } = NS.util;

  const defs = new Map();     // id -> descriptor
  const live = new Map();     // id -> resolved instance
  const failed = new Map();   // id -> Error

  /** Core services a module may list in `requires`. */
  const CORE = new Set(['data', 'nlp', 'util', 'chatEngine']);

  function define(descriptor) {
    if (!descriptor || !descriptor.id) throw new Error('[registry] descriptor needs an id');
    if (defs.has(descriptor.id)) {
      console.warn(`[registry] "${descriptor.id}" redefined — keeping the first`);
      return;
    }
    defs.set(descriptor.id, {
      version: '0.0.0', requires: [], mount: null, routes: [], nav: null,
      ...descriptor
    });
    bus.emit('registry:defined', descriptor.id);
  }

  /** Topological order over `requires`, ignoring core services. */
  function order() {
    const seen = new Set(), out = [], mark = new Set();
    const visit = (id) => {
      if (seen.has(id)) return;
      if (mark.has(id)) throw new Error(`[registry] dependency cycle at "${id}"`);
      mark.add(id);
      const d = defs.get(id);
      if (d) {
        d.requires.filter((r) => !CORE.has(r)).forEach(visit);
        out.push(id);
      }
      mark.delete(id);
      seen.add(id);
    };
    [...defs.keys()].forEach(visit);
    return out;
  }

  function context(descriptor, mountEl) {
    return {
      data: NS.data, nlp: NS.nlp, util: NS.util, bus,
      el: NS.util.el, mountEl,
      registry: { get, has, list }
    };
  }

  /**
   * Boot all defined modules. A module that throws is isolated: it is
   * recorded in `failed` and the rest still start. One broken feature must
   * never take down the page — that is exactly how two syntax errors
   * silently disabled the chat widget and the career tool previously.
   */
  async function start() {
    const ids = order();
    for (const id of ids) {
      const d = defs.get(id);
      try {
        /* Skip modules whose mount point is absent on this page. */
        let mountEl = null;
        if (d.mount) {
          mountEl = document.querySelector(d.mount);
          if (!mountEl) { continue; }
        }
        /* Verify non-core dependencies actually started. */
        const missing = d.requires.filter((r) => !CORE.has(r) && !live.has(r));
        if (missing.length) throw new Error(`unmet dependency: ${missing.join(', ')}`);
        if (d.requires.some((r) => CORE.has(r) && !NS[r])) {
          throw new Error(`core service unavailable: ${d.requires.filter((r) => CORE.has(r) && !NS[r]).join(', ')}`);
        }

        const instance = d.setup ? await d.setup(context(d, mountEl)) : {};
        live.set(id, instance || {});
        if (d.routes.length && NS.router) d.routes.forEach((r) => NS.router.claim(r, id));
        bus.emit('registry:started', { id, version: d.version });
      } catch (err) {
        failed.set(id, err);
        console.error(`[registry] module "${id}" failed to start:`, err);
        bus.emit('registry:failed', { id, error: err });
      }
    }
    bus.emit('registry:ready', { started: [...live.keys()], failed: [...failed.keys()] });
    return { started: [...live.keys()], failed: [...failed.keys()] };
  }

  const get = (id) => live.get(id) || null;
  const has = (id) => live.has(id);
  const list = () => [...defs.values()].map((d) => ({
    id: d.id, version: d.version, status: live.has(d.id) ? 'started'
      : failed.has(d.id) ? 'failed' : 'idle',
    error: failed.has(d.id) ? failed.get(d.id).message : null
  }));

  /** Nav entries contributed by modules, for building menus dynamically. */
  const navItems = () => [...defs.values()]
    .filter((d) => d.nav && live.has(d.id))
    .map((d) => ({ ...d.nav, id: d.id }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  NS.registry = { define, start, get, has, list, navItems, order, CORE };
})(window);
