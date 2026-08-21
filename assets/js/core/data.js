/**
 * core/data.js — the single source of truth.
 *
 * README known-issue #1: credentials.json had forked into three independent
 * copies (repo root, an inline object in career-automation.html, and a
 * hardcoded metrics block in asilva-widget.js). Update one, the other two go
 * stale silently.
 *
 * This module is the only thing in the platform that reads those files.
 * Every consumer — chat engine, career tool, blog, future modules — calls
 * ASilva.data.load() and gets one shared, cached, normalized object.
 *
 * The embedded MINIMAL constant below is a genuine last-resort fallback for
 * a hard fetch failure (offline first-visit, CDN hiccup). It is deliberately
 * tiny: enough to keep the UI honest, not a second copy of the profile.
 */
(function (root) {
  'use strict';

  const NS = (root.ASilva = root.ASilva || {});
  if (NS.data) return;
  const { storage } = NS.util;

  const CACHE_KEY = 'asilva:data:v1';
  const CACHE_TTL = 1000 * 60 * 60 * 6; // 6h

  /* Last-resort shell. NOT a profile copy — just enough to fail gracefully. */
  const MINIMAL = {
    profile: {
      name: 'Alvin M. Silva, MDM',
      title: 'Development Management Professional & Resilience Consultant',
      email: 'alvin.silva@asilvainnovations.com'
    },
    institutions: [], disciplines: [], projects: [], publications: [], cv_versions: [],
    _degraded: true
  };

  let _promise = null;
  let _cache = null;

  function prefix() {
    return /\/personal-resilience\//.test(location.pathname) ? '../' : '';
  }

  async function fetchJSON(path) {
    const res = await fetch(prefix() + path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return res.json();
  }

  /**
   * Normalize the raw files into the shape every consumer expects, and
   * derive fields that would otherwise be recomputed in three places.
   */
  function normalize(creds, kb) {
    const p = creds.profile || {};
    const projects = (creds.projects || []).map((x) => ({
      ...x,
      id: slug(x.name),
      keywords: x.keywords || [],
      sector: x.sector || 'general'
    }));
    const disciplines = (creds.disciplines || []).map((d) => ({
      ...d, id: slug(d.name), keywords: d.keywords || [], projects: d.projects || []
    }));

    return {
      profile: p,
      institutions: creds.institutions || [],
      disciplines,
      projects,
      publications: (creds.publications || []).map((x) => ({ ...x, id: slug(x.title) })),
      cv_versions: creds.cv_versions || [],
      kb: kb || { entries: [], intents: [], suggestions: [] },

      /* ---- derived indexes, computed once ---- */
      bySector: projects.reduce((acc, x) => {
        (acc[x.sector] = acc[x.sector] || []).push(x); return acc;
      }, {}),
      projectById: Object.fromEntries(projects.map((x) => [x.id, x])),
      disciplineById: Object.fromEntries(disciplines.map((x) => [x.id, x])),
      years: p.years_total ?? null,
      updated: new Date().toISOString()
    };
  }

  function slug(s) {
    return String(s || '').toLowerCase()
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Load and cache. Safe to call from any number of modules — the in-flight
   * promise is shared, so N callers produce exactly one network round trip.
   */
  function load() {
    if (_cache) return Promise.resolve(_cache);
    if (_promise) return _promise;

    _promise = (async () => {
      /* Warm start from sessionStorage-backed cache when fresh. */
      const cached = storage.getJSON(CACHE_KEY, null);
      if (cached && cached._t && Date.now() - cached._t < CACHE_TTL && cached.data) {
        _cache = cached.data;
        revalidate();               // refresh in background, don't block
        return _cache;
      }

      try {
        const [creds, kb] = await Promise.all([
          fetchJSON('credentials.json'),
          fetchJSON('assets/data/kb.json').catch(() => null)  // KB is optional
        ]);
        _cache = normalize(creds, kb);
        storage.setJSON(CACHE_KEY, { _t: Date.now(), data: _cache });
      } catch (err) {
        console.warn('[ASilva.data] falling back to minimal shell:', err.message);
        _cache = normalize(MINIMAL, null);
        _cache._degraded = true;
      }
      NS.util.bus.emit('data:ready', _cache);
      return _cache;
    })();

    return _promise;
  }

  async function revalidate() {
    try {
      const [creds, kb] = await Promise.all([
        fetchJSON('credentials.json'),
        fetchJSON('assets/data/kb.json').catch(() => null)
      ]);
      _cache = normalize(creds, kb);
      storage.setJSON(CACHE_KEY, { _t: Date.now(), data: _cache });
      NS.util.bus.emit('data:refreshed', _cache);
    } catch (_) { /* keep the warm copy */ }
  }

  /** Synchronous accessor — null until load() resolves. */
  const peek = () => _cache;

  NS.data = { load, peek, revalidate, slug, MINIMAL };
})(window);
