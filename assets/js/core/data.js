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

  /* v2: v1 caches were written by a normalize() that dropped
     certifications/memberships/appointments/technical_training. Bumping the
     key discards those incomplete warm copies instead of serving them for 6h. */
  const CACHE_KEY = 'asilva:data:v2';
  const SCHEMA_VERSION = 2;
  const CACHE_TTL = 1000 * 60 * 60 * 6; // 6h

  /* Last-resort shell. NOT a profile copy — just enough to fail gracefully. */
  const MINIMAL = {
    profile: {
      name: 'Alvin M. Silva, MDM',
      title: 'Development Management Professional & Resilience Consultant',
      email: 'alvin.silva@asilvainnovations.com'
    },
    institutions: [], disciplines: [], projects: [], publications: [], cv_versions: [],
    certifications: [], memberships: [], appointments: [], technical_training: null,
    _degraded: true
  };

  let _promise = null;
  let _cache = null;

  function prefix() {
    /* The shell resolves the site root from its own URL, so nested pages
       (tools/, personal-resilience/) fetch the same files. */
    if (window.ASilvaShell && window.ASilvaShell.base) return window.ASilvaShell.base;
    return /\/(personal-resilience|tools)\//.test(location.pathname) ? '../' : '';
  }

  async function fetchJSON(path) {
    const res = await fetch(prefix() + path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return res.json();
  }

  /**
   * Validate the canonical file's contract. Returns a list of human-readable
   * problems; an empty list means the file is usable. Problems are surfaced
   * by consumers (the career workspace shows them) instead of failing silently.
   */
  function validate(creds) {
    const problems = [];
    if (!creds || typeof creds !== 'object') return ['credentials.json is not a JSON object'];
    if (!creds.profile || typeof creds.profile !== 'object') problems.push('profile object missing');
    ['institutions', 'disciplines', 'projects', 'publications', 'cv_versions', 'certifications']
      .forEach((k) => { if (!Array.isArray(creds[k])) problems.push(`${k} must be an array`); });
    (creds.disciplines || []).forEach((d, i) => {
      if (!d.name) problems.push(`disciplines[${i}] has no name`);
      if (d.years != null && typeof d.years !== 'number') problems.push(`disciplines[${i}].years must be a number`);
    });
    (creds.certifications || []).forEach((c, i) => {
      if (!c.name) problems.push(`certifications[${i}] has no name`);
      if (c.expires && !/^\d{4}-\d{2}-\d{2}$/.test(c.expires)) problems.push(`certifications[${i}].expires is not YYYY-MM-DD`);
    });
    (creds.cv_versions || []).forEach((c, i) => { if (!c.file) problems.push(`cv_versions[${i}] has no file`); });
    return problems;
  }

  /**
   * A certification's status is evaluated at read time, not trusted from the
   * file: a "valid" credential whose expiry date has passed is reported as
   * expired. Expired credentials must never be presented as current.
   */
  function certStatus(c, today = new Date()) {
    if (c.status === 'expired' || c.status === 'revoked') return c.status;
    if (c.expires) {
      const end = new Date(c.expires + 'T23:59:59');
      if (!Number.isNaN(end.getTime()) && end < today) return 'expired';
    }
    return c.status || 'unverified';
  }

  /** Evidence quality of a certification record (see career engine levels). */
  function certEvidence(c) {
    return (c.verify_url || c.credential_id || c.evidence) ? 'verified' : 'documented';
  }

  /**
   * Normalize the raw files into the shape every consumer expects, and
   * derive fields that would otherwise be recomputed in three places.
   * Every canonical collection is passed through — consumers must never need
   * a second loader because a field was dropped here.
   */
  function normalize(creds, kb, source) {
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
    const certifications = (creds.certifications || []).map((c) => ({
      ...c, id: slug(c.name), status: certStatus(c), declaredStatus: c.status || null,
      evidenceLevel: certEvidence(c)
    }));

    return {
      schemaVersion: SCHEMA_VERSION,
      profile: p,
      institutions: creds.institutions || [],
      disciplines,
      projects,
      publications: (creds.publications || []).map((x) => ({ ...x, id: slug(x.title) })),
      cv_versions: creds.cv_versions || [],
      certifications,
      memberships: creds.memberships || [],
      appointments: creds.appointments || [],
      technical_training: creds.technical_training || null,
      kb: kb || { entries: [], intents: [], suggestions: [] },

      /* ---- derived indexes, computed once ---- */
      bySector: projects.reduce((acc, x) => {
        (acc[x.sector] = acc[x.sector] || []).push(x); return acc;
      }, {}),
      projectById: Object.fromEntries(projects.map((x) => [x.id, x])),
      disciplineById: Object.fromEntries(disciplines.map((x) => [x.id, x])),
      activeCertifications: certifications.filter((c) => c.status === 'valid' || c.status === 'active'),
      years: p.years_total ?? null,

      /* ---- provenance ---- */
      _source: source || 'credentials.json',
      _problems: validate(creds),
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
      if (cached && cached.data && cached.data.schemaVersion === SCHEMA_VERSION && cached._t && Date.now() - cached._t < CACHE_TTL && cached.data) {
        _cache = cached.data;
        revalidate();               // refresh in background, don't block
        return _cache;
      }

      try {
        const [creds, kb] = await Promise.all([
          fetchJSON('credentials.json'),
          fetchJSON('assets/data/kb.json').catch(() => null)  // KB is optional
        ]);
        _cache = normalize(creds, kb, 'credentials.json');
        storage.setJSON(CACHE_KEY, { _t: Date.now(), data: _cache });
      } catch (err) {
        console.warn('[ASilva.data] falling back to minimal shell:', err.message);
        _cache = normalize(MINIMAL, null, 'embedded-minimal');
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
      _cache = normalize(creds, kb, 'credentials.json');
      storage.setJSON(CACHE_KEY, { _t: Date.now(), data: _cache });
      NS.util.bus.emit('data:refreshed', _cache);
    } catch (_) { /* keep the warm copy */ }
  }

  /** Synchronous accessor — null until load() resolves. */
  const peek = () => _cache;

  /** Bypass the warm cache (used after credentials.json is edited). */
  async function reload() {
    _cache = null; _promise = null;
    storage.remove(CACHE_KEY);
    return load();
  }

  NS.data = { load, peek, revalidate, reload, slug, validate, certStatus, MINIMAL, SCHEMA_VERSION };
})(window);
