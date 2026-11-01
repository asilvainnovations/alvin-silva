/**
 * career-store.js — private career records for the CIOMS workspace (D4).
 *
 * Data classes
 *   public   credentials.json — read through ASilva.data, never written here
 *   private  opportunities, applications, notes, development plan, settings —
 *            kept here, never in the service-worker cache
 *
 * Persistence
 *   local    localStorage key "asilva:career:v3" (always on). Tied to one
 *            browser; the UI says so and offers export/import.
 *   sync     optional private backend (Supabase Auth + Postgres with RLS,
 *            see supabase/migrations). Dormant until a project URL and anon
 *            key are configured in Settings and the user signs in by e-mail
 *            link. Last-writer-wins per record, deletions as tombstones.
 *
 * Legacy data under "as-career-tracker" (v1 numeric ids, v2 uuid records) is
 * migrated once; the original array is kept under a backup key until the user
 * removes it from Settings.
 */
(function (root) {
  'use strict';
  const NS = (root.ASilva = root.ASilva || {});
  if (NS.careerStore) return;

  const KEY = 'asilva:career:v3';
  const LEGACY_KEY = 'as-career-tracker';
  const LEGACY_BACKUP = 'asilva:career:legacy-backup';
  const SESSION_KEY = 'asilva:career:session';
  const SCHEMA = 3;

  const STAGES = ['Discovered', 'Assessing', 'Shortlisted', 'Preparing', 'Applied', 'Interview', 'Offer', 'Accepted'];
  const CLOSED = ['Rejected', 'Withdrawn', 'No response', 'Closed'];
  const STATUSES = STAGES.concat(CLOSED);
  const LEGACY_STATUS = { New: 'Discovered', Analyzing: 'Assessing', Applied: 'Applied', Interview: 'Interview', Offer: 'Offer', Rejected: 'Rejected', Withdrawn: 'Withdrawn', Ghosted: 'No response' };

  const DEFAULT_SETTINGS = {
    pathwayPriorities: {},          // engine PATHWAYS id -> 1..5 (unset = 3)
    retentionDays: 365,             // closed records: purge source text & letters after N days
    storeSourceText: true,
    storeLetters: true,
    notifyDays: 7,
    sync: { url: '', anonKey: '', extractEndpoint: '' }
  };

  /* ------------------------------------------------------------ primitives */
  const now = () => new Date().toISOString();
  const uid = () => (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  const ls = {
    get(k) { try { return root.localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { root.localStorage.setItem(k, v); },
    del(k) { try { root.localStorage.removeItem(k); } catch (_) { /* noop */ } }
  };
  const listeners = new Set();
  const emit = (why) => listeners.forEach((fn) => { try { fn(why); } catch (e) { console.error('[careerStore] listener', e); } });

  function blank() {
    return { schema: SCHEMA, opportunities: [], devplan: [], settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), tombstones: [], meta: { createdAt: now() } };
  }

  /* ------------------------------------------------------------- migration */
  function migrateLegacy(db) {
    const raw = ls.get(LEGACY_KEY);
    if (!raw) return 0;
    let arr;
    try { arr = JSON.parse(raw); } catch (_) { return 0; }
    if (!Array.isArray(arr) || !arr.length) { ls.del(LEGACY_KEY); return 0; }
    const known = new Set(db.opportunities.map((o) => o.legacyId).filter(Boolean));
    let n = 0;
    arr.forEach((x) => {
      const legacyId = String(x.id);
      if (known.has(legacyId)) return;
      const created = x.dateAdded ? new Date(x.dateAdded).toISOString() : now();
      const status = LEGACY_STATUS[x.status] || 'Discovered';
      db.opportunities.push({
        id: uid(), legacyId, schema: SCHEMA, createdAt: created, updatedAt: now(),
        source: { url: '', text: x.sourceText || '', retrievedAt: null },
        job: { title: x.role || '', organization: x.organization || '', location: x.location || '', sector: x.sector || '', deadline: x.deadlineISO || '', deadlineRaw: x.deadline || '' },
        assessment: { modelVersion: x.modelVersion || 'legacy-v1', legacyScore: Number(x.score) || null, alignment: x.modelVersion ? Number(x.score) || null : null, feasibility: x.feasibility ?? null, careerValue: x.careerValue ?? null, confidence: x.confidence ?? null },
        cv: x.cv || '', coverLetter: x.coverLetter || '',
        application: blankApplication(status, created)
      });
      n++;
    });
    ls.set(LEGACY_BACKUP, raw);
    ls.del(LEGACY_KEY);
    db.meta.migratedLegacy = (db.meta.migratedLegacy || 0) + n;
    return n;
  }

  function blankApplication(status, at) {
    return { status: status || 'Discovered', events: [{ at: at || now(), type: 'status', to: status || 'Discovered' }],
      submittedAt: '', documents: [], contacts: [], followUps: [], interviews: [], notes: '', salaryExpectation: '',
      outcome: { result: '', reason: '', lessons: '' } };
  }

  /* ------------------------------------------------------------------ load */
  let db = null;
  let lastError = null;
  function load() {
    if (db) return db;
    const raw = ls.get(KEY);
    if (raw) {
      try { db = JSON.parse(raw); } catch (e) { lastError = 'Stored career data was unreadable and has been preserved under asilva:career:corrupt.'; ls.set('asilva:career:corrupt', raw); db = null; }
    }
    if (!db || db.schema !== SCHEMA) db = Object.assign(blank(), db && db.schema === SCHEMA ? db : {});
    db.settings = deepMerge(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), db.settings || {});
    db.tombstones = db.tombstones || [];
    const migrated = migrateLegacy(db);
    if (migrated) persist('migrate');
    return db;
  }

  function deepMerge(base, over) {
    for (const [k, v] of Object.entries(over || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') base[k] = deepMerge(base[k], v);
      else base[k] = v;
    }
    return base;
  }

  function persist(why) {
    try { ls.set(KEY, JSON.stringify(db)); lastError = null; }
    catch (e) { lastError = 'This browser refused to save (storage full or blocked). Export your records now.'; emit('error'); throw e; }
    emit(why || 'change');
    scheduleSync();
  }

  /* --------------------------------------------------------- opportunities */
  const all = () => load().opportunities.slice();
  const get = (id) => load().opportunities.find((o) => o.id === id) || null;

  function normKey(o) {
    const n = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return n(o.job && o.job.organization) + '|' + n(o.job && o.job.title);
  }
  function findDuplicate(candidate) {
    const key = normKey(candidate);
    const url = candidate.source && candidate.source.url;
    return all().find((o) => o.id !== candidate.id && ((url && o.source && o.source.url === url) || (key !== '|' && normKey(o) === key))) || null;
  }

  function upsert(opp) {
    const d = load();
    const i = d.opportunities.findIndex((o) => o.id === opp.id);
    const rec = Object.assign({ schema: SCHEMA }, opp, { updatedAt: now() });
    if (!rec.id) rec.id = uid();
    if (!rec.createdAt) rec.createdAt = rec.updatedAt;
    if (!rec.application) rec.application = blankApplication('Assessing');
    if (!d.settings.storeSourceText && rec.source) rec.source.text = '';
    if (!d.settings.storeLetters) rec.coverLetter = '';
    if (i === -1) d.opportunities.unshift(rec); else d.opportunities[i] = rec;
    persist('upsert');
    return rec;
  }

  function setStatus(id, status, note) {
    const o = get(id);
    if (!o || !STATUSES.includes(status) || o.application.status === status) return o;
    o.application.events.push({ at: now(), type: 'status', from: o.application.status, to: status, note: note || '' });
    o.application.status = status;
    if (status === 'Applied' && !o.application.submittedAt) o.application.submittedAt = now().slice(0, 10);
    return upsert(o);
  }

  function addEvent(id, type, payload) {
    const o = get(id); if (!o) return null;
    o.application.events.push(Object.assign({ at: now(), type }, payload || {}));
    return upsert(o);
  }

  function remove(id) {
    const d = load();
    d.opportunities = d.opportunities.filter((o) => o.id !== id);
    d.devplan.forEach((g) => { g.sources = (g.sources || []).filter((s) => s !== id); });
    d.tombstones.push({ id, kind: 'opportunity', at: now() });
    persist('remove');
  }

  /* -------------------------------------------------------------- devplan */
  const devplan = () => load().devplan.slice();
  function upsertDev(item) {
    const d = load();
    const rec = Object.assign({ id: uid(), createdAt: now(), status: 'Planned', sources: [] }, item, { updatedAt: now() });
    const i = d.devplan.findIndex((x) => x.id === rec.id || (x.competency && x.competency === rec.competency && x.type === rec.type && x.status !== 'Done'));
    if (i === -1) d.devplan.unshift(rec);
    else { rec.id = d.devplan[i].id; rec.sources = [...new Set((d.devplan[i].sources || []).concat(rec.sources || []))]; d.devplan[i] = Object.assign(d.devplan[i], rec); }
    persist('devplan');
    return rec;
  }
  function removeDev(id) { const d = load(); d.devplan = d.devplan.filter((x) => x.id !== id); d.tombstones.push({ id, kind: 'devplan', at: now() }); persist('devplan'); }

  /* ------------------------------------------------------------- settings */
  const settings = () => JSON.parse(JSON.stringify(load().settings));
  function setSettings(patch) { const d = load(); d.settings = deepMerge(d.settings, patch); persist('settings'); return settings(); }

  /* ------------------------------------------------------------- retention */
  /** Purge bulky private text from closed records older than retentionDays. */
  function applyRetention() {
    const d = load();
    const days = Number(d.settings.retentionDays) || 0;
    if (!days) return 0;
    const cutoff = Date.now() - days * 86400000;
    let n = 0;
    d.opportunities.forEach((o) => {
      if (!CLOSED.includes(o.application.status) && o.application.status !== 'Accepted') return;
      if (new Date(o.updatedAt).getTime() > cutoff) return;
      if ((o.source && o.source.text) || o.coverLetter) { if (o.source) o.source.text = ''; o.coverLetter = ''; o.retentionPurgedAt = now(); n++; }
    });
    if (n) persist('retention');
    return n;
  }

  /* ---------------------------------------------------------- export/import */
  function exportJSON() {
    const d = load();
    return JSON.stringify({ exportedAt: now(), app: 'cioms', schema: SCHEMA, opportunities: d.opportunities, devplan: d.devplan, settings: Object.assign({}, d.settings, { sync: { url: d.settings.sync.url, anonKey: '', extractEndpoint: d.settings.sync.extractEndpoint } }) }, null, 2);
  }

  function importJSON(text) {
    const data = JSON.parse(text);
    if (!data || data.app !== 'cioms' || !Array.isArray(data.opportunities)) throw new Error('Not a CIOMS export file.');
    const d = load();
    let added = 0, updated = 0;
    data.opportunities.forEach((o) => {
      if (!o || !o.id || !o.job || !o.application) return;
      const i = d.opportunities.findIndex((x) => x.id === o.id);
      if (i === -1) { d.opportunities.push(o); added++; }
      else if (new Date(o.updatedAt) > new Date(d.opportunities[i].updatedAt)) { d.opportunities[i] = o; updated++; }
    });
    (data.devplan || []).forEach((g) => { if (g && g.id && !d.devplan.some((x) => x.id === g.id)) d.devplan.push(g); });
    persist('import');
    return { added, updated };
  }

  /** CSV cell with spreadsheet formula-injection protection. */
  function csvCell(v) {
    let t = String(v == null ? '' : v);
    if (/^[\s\u0000-\u001f]*[=+\-@\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  }
  function exportCSV() {
    const head = ['Organization', 'Position', 'Sector', 'Location', 'Deadline', 'Status', 'Submitted', 'Alignment', 'Feasibility', 'Career value', 'Confidence', 'Eligibility', 'Decision', 'CV', 'Model version', 'Created', 'Updated', 'Source URL'];
    const rows = all().map((o) => {
      const a = o.assessment || {};
      return [o.job.organization, o.job.title, o.job.sector, o.job.location, o.job.deadline || o.job.deadlineRaw, o.application.status, o.application.submittedAt,
        a.alignment, a.feasibility, a.careerValue, a.confidence, a.eligibility, a.decision, o.cv, a.modelVersion, (o.createdAt || '').slice(0, 10), (o.updatedAt || '').slice(0, 10), o.source && o.source.url].map(csvCell).join(',');
    });
    return '﻿' + [head.map(csvCell).join(',')].concat(rows).join('\r\n');
  }

  function clearAll() {
    const d = load();
    d.opportunities.forEach((o) => d.tombstones.push({ id: o.id, kind: 'opportunity', at: now() }));
    d.devplan.forEach((g) => d.tombstones.push({ id: g.id, kind: 'devplan', at: now() }));
    d.opportunities = []; d.devplan = [];
    persist('clear');
  }
  const hasLegacyBackup = () => !!ls.get(LEGACY_BACKUP);
  const dropLegacyBackup = () => { ls.del(LEGACY_BACKUP); emit('legacy'); };
  function usage() {
    const raw = ls.get(KEY) || '';
    return { bytes: raw.length * 2, opportunities: load().opportunities.length, devplan: load().devplan.length };
  }

  /* ================================================================ sync */
  const sync = (() => {
    let session = null;
    let timer = null;
    let state = { status: 'off', message: 'Private backend not configured — records stay in this browser.' };
    const setState = (s) => { state = Object.assign({}, state, s); emit('sync'); };
    const cfg = () => load().settings.sync || {};
    const configured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg().url || '') && !!cfg().anonKey;
    const base = () => String(cfg().url).replace(/\/$/, '');

    function readSession() { try { session = JSON.parse(ls.get(SESSION_KEY) || 'null'); } catch (_) { session = null; } return session; }
    function writeSession(s) { session = s; if (s) ls.set(SESSION_KEY, JSON.stringify(s)); else ls.del(SESSION_KEY); }

    /** Pick up the magic-link redirect (#access_token=…) and clear it from the URL. */
    function captureRedirect() {
      const h = root.location.hash || '';
      if (!/access_token=/.test(h)) return false;
      const q = new URLSearchParams(h.replace(/^#/, ''));
      const s = { access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), expires_at: Date.now() + (Number(q.get('expires_in')) || 3600) * 1000 };
      if (s.access_token) writeSession(s);
      try { root.history.replaceState(null, '', root.location.pathname + root.location.search + '#ws-settings'); } catch (_) { /* noop */ }
      return !!s.access_token;
    }

    async function api(path, init) {
      const res = await fetch(base() + path, Object.assign({}, init, {
        headers: Object.assign({ apikey: cfg().anonKey, 'Content-Type': 'application/json' }, session ? { Authorization: 'Bearer ' + session.access_token } : {}, (init && init.headers) || {})
      }));
      if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`HTTP ${res.status}${t ? ': ' + t.slice(0, 160) : ''}`); }
      return res.status === 204 ? null : res.json().catch(() => null);
    }

    async function ensureFresh() {
      if (!session) return false;
      if (session.expires_at - Date.now() > 60000) return true;
      if (!session.refresh_token) { writeSession(null); return false; }
      try {
        const r = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) });
        writeSession({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Date.now() + (r.expires_in || 3600) * 1000, email: r.user && r.user.email });
        return true;
      } catch (e) { writeSession(null); setState({ status: 'signed-out', message: 'Session expired — sign in again.' }); return false; }
    }

    async function signIn(email) {
      if (!configured()) throw new Error('Configure the Supabase project URL and anon key first.');
      const redirect = root.location.origin + root.location.pathname;
      /* REST form of GoTrue magic link: redirect is a query parameter and must
         be listed under Auth › URL Configuration › Redirect URLs. create_user
         is false so only an account created in the dashboard can sign in. */
      await api('/auth/v1/otp?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', body: JSON.stringify({ email, create_user: false }) });
      setState({ status: 'pending', message: `Sign-in link sent to ${email}. Open it in this browser.` });
    }
    function signOut() { writeSession(null); setState({ status: 'signed-out', message: 'Signed out. Records remain in this browser.' }); }

    function userId() {
      try { return JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch (_) { return null; }
    }
    function toRows() {
      const d = load();
      const user_id = userId();
      const row = (id, kind, data, at, deleted) => ({ user_id, id, kind, schema: SCHEMA, data, updated_at: at, deleted });
      return d.opportunities.map((o) => row(o.id, 'opportunity', o, o.updatedAt, false))
        .concat(d.devplan.map((g) => row(g.id, 'devplan', g, g.updatedAt || g.createdAt, false)))
        .concat(d.tombstones.map((t) => row(t.id, t.kind, {}, t.at, true)));
    }

    async function run() {
      if (!configured()) { setState({ status: 'off', message: 'Private backend not configured — records stay in this browser.' }); return; }
      readSession();
      if (!(await ensureFresh())) { setState({ status: 'signed-out', message: 'Configured. Sign in to sync across devices.' }); return; }
      setState({ status: 'syncing', message: 'Syncing…' });
      try {
        const remote = await api('/rest/v1/career_records?select=id,kind,data,updated_at,deleted', { method: 'GET' }) || [];
        const d = load();
        let pulled = 0;
        remote.forEach((r) => {
          const list = r.kind === 'opportunity' ? d.opportunities : r.kind === 'devplan' ? d.devplan : null;
          if (!list) return;
          const i = list.findIndex((x) => x.id === r.id);
          const localAt = i === -1 ? 0 : new Date(list[i].updatedAt || list[i].createdAt).getTime();
          const remoteAt = new Date(r.updated_at).getTime();
          if (r.deleted) { if (i !== -1 && remoteAt >= localAt) { list.splice(i, 1); pulled++; } return; }
          if (i === -1 && !d.tombstones.some((t) => t.id === r.id)) { list.push(r.data); pulled++; }
          else if (i !== -1 && remoteAt > localAt) { list[i] = r.data; pulled++; }
        });
        try { ls.set(KEY, JSON.stringify(d)); } catch (_) { /* reported by persist next time */ }
        const rows = toRows();
        if (rows.length) await api('/rest/v1/career_records?on_conflict=user_id,id', { method: 'POST', body: JSON.stringify(rows), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
        d.tombstones = [];
        try { ls.set(KEY, JSON.stringify(d)); } catch (_) { /* noop */ }
        setState({ status: 'synced', message: `Synced ${new Date().toLocaleTimeString()} — ${pulled} pulled, ${rows.length} pushed.`, lastSync: now() });
        if (pulled) emit('pulled');
      } catch (e) {
        setState({ status: 'error', message: 'Sync failed: ' + e.message + '. Records are safe in this browser.' });
      }
    }

    function schedule() { if (!configured() || !session) return; clearTimeout(timer); timer = setTimeout(run, 1500); }

    function init() {
      readSession();
      if (captureRedirect()) setState({ status: 'syncing', message: 'Signed in. Syncing…' });
      if (configured()) run(); else setState({ status: 'off', message: 'Private backend not configured — records stay in this browser.' });
    }

    function extractEndpoint() {
      const c = cfg();
      if (c.extractEndpoint) return c.extractEndpoint;
      return configured() ? base() + '/functions/v1/job-extract' : '';
    }
    async function authHeaders() {
      if (session) await ensureFresh();
      const h = { 'Content-Type': 'application/json' };
      if (cfg().anonKey) h.apikey = cfg().anonKey;
      if (session) h.Authorization = 'Bearer ' + session.access_token;
      return h;
    }

    return { init, run, schedule, signIn, signOut, configured, state: () => state, session: () => readSession(), extractEndpoint, authHeaders };
  })();
  function scheduleSync() { sync.schedule(); }

  NS.careerStore = {
    SCHEMA, STAGES, CLOSED, STATUSES,
    load, all, get, upsert, setStatus, addEvent, remove, findDuplicate, blankApplication,
    devplan, upsertDev, removeDev, settings, setSettings, applyRetention,
    exportJSON, importJSON, exportCSV, csvCell, clearAll, usage, hasLegacyBackup, dropLegacyBackup,
    lastError: () => lastError,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    sync, uid
  };
})(typeof window !== 'undefined' ? window : globalThis);
