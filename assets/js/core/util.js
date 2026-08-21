/**
 * core/util.js — shared primitives for the ASilva platform.
 * No dependencies. Loaded first by every module.
 */
(function (root) {
  'use strict';

  const NS = (root.ASilva = root.ASilva || {});
  if (NS.util) return;

  /* ---------------------------------------------------------------- escaping */

  /**
   * Escape untrusted text for interpolation into innerHTML.
   * Every string that originates outside developer-authored source — visitor
   * input, JSON fields, URL params — MUST pass through this before it touches
   * innerHTML. Prior widget versions interpolated raw, which allowed an
   * <img onerror=...> payload to read localStorage.
   */
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  /** Escape a string for safe use inside an HTML attribute value. */
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Render a very small, fixed subset of inline markup from KB content:
   * **bold**, [label](url), and newlines. Everything else is escaped first,
   * so authored KB text can carry emphasis without opening an HTML hole.
   */
  function renderInline(str) {
    let s = escapeHtml(str);
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[a-zA-Z0-9._#/-]+)\)/g,
      (_, label, href) => `<a href="${escapeAttr(href)}"${/^https?:/.test(href)
        ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  /* ---------------------------------------------------------------- storage */

  /**
   * localStorage wrapper that degrades to an in-memory map. Safari private
   * mode and some embedded webviews throw on setItem rather than failing
   * silently, which previously broke widget init entirely.
   */
  const memFallback = new Map();
  const storage = {
    get(key, fallback = null) {
      try {
        const v = root.localStorage.getItem(key);
        return v === null ? (memFallback.has(key) ? memFallback.get(key) : fallback) : v;
      } catch (_) {
        return memFallback.has(key) ? memFallback.get(key) : fallback;
      }
    },
    set(key, value) {
      try { root.localStorage.setItem(key, value); }
      catch (_) { memFallback.set(key, value); }
    },
    remove(key) {
      try { root.localStorage.removeItem(key); } catch (_) { /* noop */ }
      memFallback.delete(key);
    },
    getJSON(key, fallback = null) {
      const raw = storage.get(key, null);
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (_) { return fallback; }
    },
    setJSON(key, value) {
      try { storage.set(key, JSON.stringify(value)); } catch (_) { /* noop */ }
    }
  };

  /* ---------------------------------------------------------------- dom */

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else node.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  const ready = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn());

  /* ---------------------------------------------------------------- events */

  /** Minimal pub/sub so modules can talk without importing each other. */
  const bus = (() => {
    const map = new Map();
    return {
      on(evt, fn) {
        if (!map.has(evt)) map.set(evt, new Set());
        map.get(evt).add(fn);
        return () => map.get(evt).delete(fn);
      },
      emit(evt, payload) {
        (map.get(evt) || []).forEach((fn) => {
          try { fn(payload); } catch (e) { console.error(`[ASilva] handler for "${evt}" threw`, e); }
        });
      }
    };
  })();

  /* ---------------------------------------------------------------- misc */

  const debounce = (fn, ms = 180) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  /** Resolve a repo-root-relative asset path from any nesting depth. */
  function basePath() {
    const depth = (location.pathname.replace(/\/[^/]*$/, '/').match(/\//g) || []).length - 1;
    const inSub = /\/personal-resilience\//.test(location.pathname);
    return inSub ? '../' : (depth > 1 && !/\/$/.test(location.pathname) ? '' : '');
  }

  NS.util = {
    escapeHtml, escapeAttr, renderInline,
    storage, el, ready, bus, debounce, basePath
  };
})(window);
