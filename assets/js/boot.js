/**
 * boot.js — the single script tag every page needs.
 *
 *   <script src="assets/js/boot.js" defer></script>
 *
 * Loads core in dependency order, then every registered module, then starts
 * the registry and router. Adding a feature means adding one line to MODULES
 * below — no HTML file changes.
 *
 * Classic scripts, not ES modules, deliberately: the site has no build step
 * and must keep working from `file://` and from GitHub Pages subpaths alike.
 */
(function (root) {
  'use strict';
  if (root.__ASILVA_BOOTED__) return;
  root.__ASILVA_BOOTED__ = true;

  /* Resolve asset root from this script's own src, so nested pages
     (personal-resilience/*.html) load the same files without ../ juggling. */
  const SELF = document.currentScript && document.currentScript.src;
  const BASE = SELF ? SELF.replace(/assets\/js\/boot\.js.*$/, '') : '';

  const CORE = [
    'assets/js/core/util.js',
    'assets/js/core/nlp.js',
    'assets/js/core/data.js',
    'assets/js/core/registry.js',
    'assets/js/core/router.js',
    'assets/js/chat/engine.js',
    'assets/js/chat/widget.js'
  ];

  /* ---- add new feature modules here ---- */
  const MODULES = [
    'assets/js/modules/blog.js',
    'assets/js/modules/ai-chorus.js'
  ];

  function loadScript(path) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = BASE + path;
      s.async = false;                 // preserve execution order
      s.onload = () => resolve(true);
      s.onerror = () => {
        console.error(`[boot] failed to load ${path}`);
        resolve(false);                // isolate: one bad file != dead page
      };
      document.head.appendChild(s);
    });
  }

  /**
   * One-time cleanup. The previous chat widget asked visitors to paste their
   * own Moonshot/Kimi API key into localStorage. That integration is gone, so
   * any leftover key is a credential sitting in a browser for no reason.
   * Remove it on first load of the new platform.
   */
  function purgeLegacyKeys() {
    ['asilva-kimi-key', 'asilva-chat-state', 'asilva-api-key'].forEach((k) => {
      try { if (root.localStorage.getItem(k) !== null) root.localStorage.removeItem(k); }
      catch (_) { /* storage unavailable — nothing to purge */ }
    });
  }

  async function boot() {
    purgeLegacyKeys();
    for (const p of CORE) await loadScript(p);

    if (!root.ASilva || !root.ASilva.registry) {
      console.error('[boot] core failed to initialise; modules skipped');
      return;
    }

    /* Only load modules whose mount point exists on this page. Saves a
       request per unused feature and keeps the registry log honest. */
    const wanted = MODULES.filter((p) => {
      if (/blog\.js$/.test(p)) return !!document.querySelector('[data-asilva-blog]');
      if (/ai-chorus\.js$/.test(p)) return !!document.querySelector('[data-asilva-chorus]');
      return true;
    });
    for (const p of wanted) await loadScript(p);

    const result = await root.ASilva.registry.start();
    if (root.ASilva.router) root.ASilva.router.start();

    if (result.failed.length) {
      console.warn('[boot] modules failed:', result.failed.join(', '));
    }
    root.ASilva.util.bus.emit('platform:ready', result);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window);
