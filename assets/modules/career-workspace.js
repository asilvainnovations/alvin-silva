/**
 * career-workspace.js — CIOMS (Career Intelligence & Opportunity Management
 * System) workspace UI. Registered with ASilva.registry; mounts on
 * [data-asilva-career] (career-automation.html).
 *
 * Depends on
 *   ASilva.data          canonical credentials.json (the only loader)
 *   ASilva.careerEngine  extraction, evidence, scoring, claims, letters
 *   ASilva.careerStore   private records (local + optional sync)
 *
 * No inline event handlers: everything is delegated from the mount via
 * data-action attributes, and every dynamic string goes through esc().
 */
(function (root) {
  'use strict';
  const NS = (root.ASilva = root.ASilva || {});
  if (!NS.registry) { console.error('[career-workspace] registry missing — load via boot.js'); return; }

  NS.registry.define({
    id: 'career-workspace',
    version: '3.0.0',
    requires: ['data'],
    mount: '[data-asilva-career]',
    async setup(ctx) {
      const E = NS.careerEngine;
      const S = NS.careerStore;
      if (!E || !S) throw new Error('career-engine.js or career-store.js did not load');
      const app = createApp(ctx, E, S);
      await app.start();
      return app;
    }
  });

  function createApp(ctx, E, S) {
    const doc = document;
    const $ = (sel, r) => (r || doc).querySelector(sel);
    const $$ = (sel, r) => [...(r || doc).querySelectorAll(sel)];
    const esc = ctx.util.escapeHtml;
    const mount = ctx.mountEl;

    let creds = null;      // normalized ASilva.data object
    let raw = null;        // credentials shape the engine expects
    let ev = null;         // evidence index
    let current = null;    // { job, edits, result, claims, url, recordId }

    /* ------------------------------------------------------------ helpers */
    const tone = (n) => (n >= 75 ? 'tone-high' : n >= 55 ? 'tone-mid' : 'tone-low');
    const LEVEL_BADGE = { verified: 'verified', documented: 'documented', 'self-reported': 'self-reported', inferred: 'inferred', unknown: 'unknown', unverified: 'unverified' };
    const STATUS_BADGE = { met: 'met', 'likely met': 'likely', 'needs verification': 'verify', 'manual check': 'manual', 'not evidenced': 'not', expired: 'expired' };
    const badge = (cls, text) => `<span class="ws-badge ${esc(cls)}">${esc(text)}</span>`;
    const levelBadge = (lvl) => badge(LEVEL_BADGE[lvl] || 'unknown', (E.LEVELS[lvl] && E.LEVELS[lvl].label) || lvl);
    const fmtDate = (iso) => { if (!iso) return '—'; const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso); return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); };
    const daysUntil = (iso) => { if (!iso) return null; const d = new Date(iso + 'T23:59:59'); const t = new Date(); return Math.ceil((d - t) / 86400000); };
    const SENIORITY_LABEL = { 1: 'Entry', 2: 'Officer / analyst', 3: 'Specialist / manager', 4: 'Senior / lead', 5: 'Director / head' };
    const DEGREE_LABEL = { 1: "Bachelor's", 2: "Master's", 3: 'Doctorate' };
    const isClosed = (o) => S.CLOSED.includes(o.application.status) || o.application.status === 'Accepted';

    function toast(msg, bad) {
      const box = $('#wsToasts');
      const t = doc.createElement('div');
      t.className = 'ws-toast' + (bad ? ' bad' : '');
      t.setAttribute('role', bad ? 'alert' : 'status');
      t.textContent = msg;
      box.appendChild(t);
      setTimeout(() => t.remove(), bad ? 7000 : 4200);
    }
    function download(name, text, type) {
      const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    async function copy(text) {
      try { await navigator.clipboard.writeText(text); toast('Copied to clipboard.'); }
      catch (_) { toast('Copy was blocked — select the text and copy manually.', true); }
    }
    function confirmDialog(message) { return Promise.resolve(root.confirm(message)); }

    /* ---------------------------------------------------------------- tabs */
    const TABS = ['overview', 'discover', 'assess', 'applications', 'evidence', 'development', 'analytics', 'settings'];
    function showTab(id, opts) {
      if (!TABS.includes(id)) id = 'overview';
      $$('.ws-tab', mount).forEach((t) => {
        const on = t.dataset.tab === id;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      $$('.ws-panel', mount).forEach((p) => { p.hidden = p.id !== 'ws-' + id; });
      if (!(opts && opts.noHash)) { try { root.history.replaceState(null, '', '#ws-' + id); } catch (_) { /* noop */ } }
      render(id);
      if (opts && opts.anchor) { const a = doc.getElementById(opts.anchor); if (a && !a.closest('[hidden]')) a.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else if (opts && opts.focus) { const tab = $('#tab-' + id); if (tab) tab.focus(); }
    }
    function bindTabs() {
      const list = $('#wsTabs');
      list.addEventListener('click', (e) => { const t = e.target.closest('.ws-tab'); if (t) showTab(t.dataset.tab); });
      list.addEventListener('keydown', (e) => {
        const tabs = $$('.ws-tab', list);
        const i = tabs.indexOf(doc.activeElement);
        if (i === -1) return;
        let n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n == null) return;
        e.preventDefault();
        showTab(tabs[n].dataset.tab, { focus: true });
      });
    }

    function render(id) {
      updateCounts();
      ({ overview: renderOverview, discover: renderDiscover, assess: () => {}, applications: renderApps, evidence: renderEvidence, development: renderDevelopment, analytics: renderAnalytics, settings: renderSettings })[id]();
    }
    function rerenderActive() {
      const sel = $('.ws-tab[aria-selected="true"]', mount);
      render(sel ? sel.dataset.tab : 'overview');
    }
    function updateCounts() {
      const opps = S.all();
      const active = opps.filter((o) => !isClosed(o)).length;
      const dev = S.devplan().filter((d) => d.status !== 'Done').length;
      const a = $('[data-count="applications"]'); if (a) a.textContent = String(active);
      const d = $('[data-count="development"]'); if (d) d.textContent = String(dev);
      const st = S.sync.state();
      const chip = $('#wsStoreStatus');
      chip.className = 'ws-chip ' + (st.status === 'synced' ? 'ok' : st.status === 'error' ? 'bad' : st.status === 'off' ? '' : 'info');
      chip.textContent = st.status === 'synced' ? 'Records: synced (private backend)' : st.status === 'error' ? 'Records: sync error — safe locally' : st.status === 'off' ? 'Records: this browser only' : 'Records: this browser · backend ' + st.status;
    }

    /* ============================================================ OVERVIEW */
    function renderOverview() {
      const opps = S.all();
      const settings = S.settings();
      const active = opps.filter((o) => !isClosed(o));
      const qualified = active.filter((o) => (o.assessment && o.assessment.alignment) >= 70 && (o.assessment.eligibility !== 'likely ineligible'));
      const apps = opps.filter((o) => ['Applied', 'Interview', 'Offer'].includes(o.application.status));
      const window = Number(settings.notifyDays) || 7;
      const upcoming = active.filter((o) => { const d = daysUntil(o.job.deadline); return d != null && d >= 0 && d <= window; });
      $('#wsKpis').innerHTML = [
        ['Active opportunities', active.length, `${opps.length} total recorded`],
        ['Qualified', qualified.length, 'alignment ≥ 70, no likely disqualifier'],
        ['Active applications', apps.length, 'Applied · Interview · Offer'],
        ['Upcoming deadlines', upcoming.length, `within ${window} days`]
      ].map(([l, n, s]) => `<div class="ws-kpi"><strong>${n}</strong><span>${esc(l)}</span><small>${esc(s)}</small></div>`).join('');

      const next = [];
      upcoming.sort((a, b) => a.job.deadline.localeCompare(b.job.deadline)).forEach((o) => {
        const d = daysUntil(o.job.deadline);
        next.push({ k: 0 + d, html: `<span><strong>${esc(o.job.title || 'Untitled')}</strong> · ${esc(o.job.organization || '')}<br><span class="ws-small">Deadline ${fmtDate(o.job.deadline)} — ${d === 0 ? 'today' : d + ' day(s) left'} · ${esc(o.application.status)}</span></span><button class="btn btn-ghost btn-sm" type="button" data-action="open-record" data-id="${esc(o.id)}">Open</button>` });
      });
      opps.forEach((o) => (o.application.followUps || []).filter((f) => !f.done && f.date).forEach((f) => {
        const d = daysUntil(f.date);
        if (d != null && d <= window) next.push({ k: d - 0.5, html: `<span><strong>Follow-up</strong> · ${esc(o.job.organization || o.job.title)}<br><span class="ws-small">${fmtDate(f.date)} — ${esc(f.note || '')}${d < 0 ? ' (overdue)' : ''}</span></span><button class="btn btn-ghost btn-sm" type="button" data-action="open-record" data-id="${esc(o.id)}">Open</button>` });
      }));
      active.filter((o) => !o.assessment || !o.assessment.alignment).slice(0, 5).forEach((o) => next.push({ k: 900, html: `<span><strong>Assess</strong> · ${esc(o.job.title || 'Untitled')} (${esc(o.job.organization || '')})<br><span class="ws-small">Discovered — no assessment yet</span></span><button class="btn btn-ghost btn-sm" type="button" data-action="assess-record" data-id="${esc(o.id)}">Assess</button>` }));
      next.sort((a, b) => a.k - b.k);
      $('#wsNext').innerHTML = next.length ? next.slice(0, 10).map((x) => `<li>${x.html}</li>`).join('') : '<li><span class="ws-muted">Nothing due. Assess a posting or log a discovered opportunity.</span></li>';

      const counts = {};
      opps.forEach((o) => { counts[o.application.status] = (counts[o.application.status] || 0) + 1; });
      const max = Math.max(1, ...Object.values(counts));
      $('#wsPipelineMini').innerHTML = opps.length ? S.STATUSES.filter((s) => counts[s]).map((s) => `<div class="ws-bar"><span>${esc(s)}</span><div class="track"><div class="fill" style="width:${Math.round(100 * counts[s] / max)}%"></div></div><span class="n">${counts[s]}</span></div>`).join('') : '<p class="ws-empty">No records yet.</p>';

      const nb = $('#wsNotifyBtn');
      if (!('Notification' in root)) { nb.disabled = true; nb.textContent = 'Reminders not supported in this browser'; }
      else if (Notification.permission === 'granted') { nb.disabled = true; nb.textContent = 'Reminders enabled on this device'; }
    }

    function notifyDue() {
      if (!('Notification' in root) || Notification.permission !== 'granted') return;
      const key = 'asilva:career:notified';
      const today = new Date().toISOString().slice(0, 10);
      let seen = {};
      try { seen = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) { seen = {}; }
      if (seen._day !== today) seen = { _day: today };
      const window = Number(S.settings().notifyDays) || 7;
      S.all().filter((o) => !isClosed(o)).forEach((o) => {
        const d = daysUntil(o.job.deadline);
        if (d == null || d < 0 || d > window || seen[o.id]) return;
        try { new Notification('Deadline: ' + (o.job.title || 'opportunity'), { body: `${o.job.organization || ''} — ${d === 0 ? 'due today' : d + ' day(s) left'}`, tag: 'cioms-' + o.id }); } catch (_) { /* noop */ }
        seen[o.id] = 1;
      });
      try { localStorage.setItem(key, JSON.stringify(seen)); } catch (_) { /* noop */ }
    }

    /* ============================================================ DISCOVER */
    const DEFAULT_SOURCES = [
      { name: 'ReliefWeb Jobs', url: 'https://reliefweb.int/jobs', sector: 'Humanitarian & development' },
      { name: 'Devex Jobs', url: 'https://www.devex.com/jobs', sector: 'International development' },
      { name: 'UN Careers', url: 'https://careers.un.org/', sector: 'United Nations' },
      { name: 'UNDP Jobs', url: 'https://jobs.undp.org/', sector: 'United Nations' },
      { name: 'Impactpool', url: 'https://www.impactpool.org/', sector: 'Multilateral & INGO' },
      { name: 'ADB Careers', url: 'https://www.adb.org/work-with-us/careers', sector: 'Development finance' },
      { name: 'World Bank Careers', url: 'https://www.worldbank.org/en/about/careers', sector: 'Development finance' },
      { name: 'PhilJobNet', url: 'https://philjobnet.gov.ph/', sector: 'Philippine government & private' },
      { name: 'JobStreet Philippines', url: 'https://www.jobstreet.com.ph/', sector: 'Private sector' },
      { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/', sector: 'All sectors' }
    ];
    function renderDiscover() {
      const custom = (S.settings().sources || []);
      const rows = DEFAULT_SOURCES.map((s) => ({ ...s, custom: false })).concat(custom.map((s) => ({ ...s, custom: true })));
      $('#wsSources').innerHTML = `<div class="ws-table-wrap"><table class="ws-table"><thead><tr><th>Source</th><th>Coverage</th><th></th></tr></thead><tbody>${rows.map((s, i) => `
        <tr><td><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a></td><td class="ws-small">${esc(s.sector || 'Custom')}</td>
        <td>${s.custom ? `<button class="ws-link" type="button" data-action="remove-source" data-index="${i - DEFAULT_SOURCES.length}">Remove</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
    }

    /* ============================================================== ASSESS */
    function assessmentSettings() { return { pathwayPriorities: S.settings().pathwayPriorities || {} }; }

    function runAssessment(job) {
      const result = E.assess(job, raw, { evidence: ev, settings: assessmentSettings() });
      const claims = E.buildClaims(job, result, raw);
      return { result, claims };
    }

    function analyze(fromRecord) {
      if (!raw || creds._degraded) { toast('Assessment is disabled because credentials.json could not be loaded.', true); return; }
      const text = $('#wsText').value.trim();
      if (text.split(/\s+/).length < 25) { toast('Paste the full posting (at least a few paragraphs) for a meaningful assessment.', true); return; }
      const job = E.extractJob(text, { institutions: raw.institutions });
      const edits = fromRecord && fromRecord.edits ? fromRecord.edits : {};
      const j2 = E.applyEdits(job, edits);
      const { result, claims } = runAssessment(j2);
      current = { job: j2, base: job, edits, result, claims, url: $('#wsUrl').value.trim(), recordId: fromRecord ? fromRecord.id : (current && !current.result && current.recordId) || null };
      renderAssessment();
      $('#wsResults').hidden = false;
      $('#wsAssessContext').textContent = fromRecord ? `Re-assessing saved record · ${fromRecord.job.title || ''}` : '';
      $('#wsExtractCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function reassess() {
      if (!current) return;
      const form = $('#wsFieldsForm');
      const edits = {};
      $$('[data-field]', form).forEach((inp) => {
        const k = inp.dataset.field;
        const orig = current.base.fields[k] ? current.base.fields[k].value : null;
        const v = inp.value.trim();
        const origS = orig == null ? '' : String(orig);
        if (v !== origS) edits[k] = v;
      });
      current.edits = edits;
      current.job = E.applyEdits(current.base, edits);
      const { result, claims } = runAssessment(current.job);
      current.result = result; current.claims = claims;
      renderAssessment();
      toast(Object.keys(edits).length ? `Re-assessed with ${Object.keys(edits).length} correction(s).` : 'Re-assessed.');
    }

    function confBadge(c) { return badge({ high: 'high', medium: 'medium', low: 'low', missing: 'missing', user: 'user' }[c] || 'unknown', c); }

    function renderAssessment() {
      const { job, result } = current;
      const F = job.fields;
      const fieldDefs = [
        ['title', 'Position', 'text'], ['organization', 'Organization', 'text'], ['location', 'Location', 'text'],
        ['deadline', 'Deadline', 'date'], ['employmentType', 'Employment type', 'select:consultancy,contract,permanent'],
        ['seniority', 'Seniority', 'select:1,2,3,4,5'], ['sector', 'Sector', 'select:government,humanitarian,private,academic'],
        ['requiredYears', 'Years required', 'number'], ['degreeLevel', 'Minimum degree', 'select:1,2,3'],
        ['duration', 'Duration', 'text'], ['remote', 'Remote / hybrid', 'text'], ['compensation', 'Compensation', 'text']
      ];
      $('#wsFieldsForm').innerHTML = fieldDefs.map(([k, label, type]) => {
        const f = F[k] || {};
        const v = f.value == null ? '' : String(f.value);
        let input;
        if (type.startsWith('select:')) {
          const opts = type.slice(7).split(',');
          const lab = (o) => k === 'seniority' ? `${o} — ${SENIORITY_LABEL[o]}` : k === 'degreeLevel' ? DEGREE_LABEL[o] : o[0].toUpperCase() + o.slice(1);
          input = `<select class="ws-select" id="wsF_${k}" data-field="${k}"><option value="">— not stated —</option>${opts.map((o) => `<option value="${o}" ${v === o ? 'selected' : ''}>${esc(lab(o))}</option>`).join('')}</select>`;
        } else input = `<input class="ws-input" id="wsF_${k}" data-field="${k}" type="${type}" value="${esc(v)}" ${type === 'number' ? 'min="0" max="45"' : ''}>`;
        const note = k === 'deadline' && f.note ? `<span class="ws-small">${esc(f.note)}${f.raw ? ` (“${esc(f.raw)}”)` : ''}</span>` : f.source && f.confidence !== 'user' ? `<span class="ws-small" title="${esc(f.source)}">from: “${esc(String(f.source).slice(0, 60))}”</span>` : '';
        return `<div class="ws-field"><label class="ws-label" for="wsF_${k}"><span>${esc(label)}</span>${confBadge(f.confidence || 'missing')}</label>${input}${note}</div>`;
      }).join('');
      const conf = result.confidence;
      $('#wsExtractConf').className = 'ws-badge ' + conf.label.toLowerCase();
      $('#wsExtractConf').textContent = `Assessment confidence: ${conf.label} (${conf.score}%)`;

      $('#wsReqCount').textContent = String(job.requirements.length);
      $('#wsReqs').innerHTML = job.requirements.length ? job.requirements.map((r) => `<div class="ws-req"><div class="tags">${badge(r.priority === 'mandatory' ? 'major' : r.priority === 'preferred' ? 'documented' : '', r.priority)}${badge('', r.type)}</div><div>${esc(r.text)}${r.competencies.length ? `<div class="ws-small">→ ${esc(r.competencies.map((c) => (E.TAXONOMY.find((t) => t.id === c) || {}).label).join(', '))}</div>` : r.unmapped ? '<div class="ws-small">→ not in the competency taxonomy (counted as unmet)</div>' : ''}</div></div>`).join('') : '<p class="ws-muted">No requirement statements detected — the posting may be very short or unstructured.</p>';

      const d = result.decision;
      $('#wsDecision').innerHTML = `<div class="ws-decision ${esc(d.code)}"><div><strong>${esc(d.label)}</strong>
        ${d.strengths.length ? `<div class="ws-small" style="margin-top:.4rem"><b>Why it fits:</b></div><ul>${d.strengths.slice(0, 4).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${d.strategic.length ? `<div class="ws-small" style="margin-top:.4rem"><b>Strategic value:</b> ${esc(d.strategic.join(' · '))}</div>` : ''}
        ${d.blockers.length ? `<div class="ws-small" style="margin-top:.4rem"><b>What stands in the way:</b></div><ul>${d.blockers.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <div class="ws-small" style="margin-top:.5rem">${esc(result.modelVersion)} · input ${esc(result.inputHash)} · decision support, not a hiring probability.</div></div></div>`;

      const tp = result.timePriority;
      $('#wsScores').innerHTML = [
        ['A · Professional alignment', result.alignment.score, 'Fit with documented profile'],
        ['B · Application feasibility', result.feasibility.score, result.feasibility.days == null ? 'Deadline unknown' : result.feasibility.days < 0 ? 'Closed' : `${result.feasibility.days} day(s) left · ~${result.feasibility.prepDays} prep day(s)`],
        ['C · Career value', result.careerValue.score, 'Strategic worth to your trajectory'],
      ].map(([l, n, s]) => `<div class="ws-score"><div class="num ${tone(n)}">${n}</div><div class="lbl">${esc(l)}</div><div class="sub">${esc(s)}</div></div>`).join('') +
        `<div class="ws-score"><div class="num" style="font-size:1.35rem;padding:.55rem 0">${esc(tp.label)}</div><div class="lbl">Time priority</div><div class="sub">Eligibility: ${esc(result.eligibility.status)}</div></div>`;

      const checks = result.eligibility.checks.concat(result.eligibility.preferred.map((c) => Object.assign({}, c, { preferredOnly: true })));
      $('#wsElig').innerHTML = (checks.length ? `<ul class="ws-list">${checks.map((c) => `<li><span>${badge(STATUS_BADGE[c.status] || '', c.status)} ${c.preferredOnly ? badge('', 'preferred') : ''}<br><span>${esc(c.text)}</span><br><span class="ws-small">${esc(c.note)}${c.evidence.length ? ' · evidence: ' + esc(c.evidence.map((id) => (ev.byId[id] || {}).title || id).slice(0, 2).join('; ')) : ''}</span></span></li>`).join('')}</ul>` : '<p class="ws-muted">No education, experience, certification, language or eligibility criteria detected. Read the posting for hidden requirements.</p>') + `<p class="ws-note warn">${esc(result.eligibility.note)}</p>`;

      const labels = { mandatory: 'Mandatory qualifications', competencies: 'Technical competencies', projects: 'Comparable project experience', leadership: 'Leadership & seniority', sector: 'Sector & institutional context', geography: 'Geographic experience', evidence: 'Evidence quality', direction: 'Strategic career direction' };
      $('#wsAlign').innerHTML = Object.keys(labels).map((k) => bar(`${labels[k]} · ${result.alignment.weights[k]}%`, result.alignment.parts[k], result.alignment.why[k])).join('');
      const fl = { time: 'Time vs preparation', documents: 'Documents ready', eligibility: 'Eligibility clarity', conditions: 'Contract & location conditions' };
      $('#wsFeas').innerHTML = Object.keys(fl).map((k) => bar(`${fl[k]} · ${result.feasibility.weights[k]}%`, result.feasibility.parts[k])).join('') +
        `<h4>Documents to submit</h4><ul class="ws-list">${result.feasibility.documents.map((dd) => `<li><span>${esc(dd.label)}${dd.assumed ? ' <span class="ws-small">(assumed)</span>' : ''}</span><span>${badge({ ready: 'met', generated: 'likely', available: 'likely', prepare: 'major', verify: 'verify' }[dd.readiness] || '', dd.readiness)}${dd.link ? ` <a class="ws-small" href="${esc(dd.link)}">open</a>` : ''}</span></li>`).join('')}</ul>` +
        (result.feasibility.conditions.length ? `<p class="ws-note warn">Conditions: ${esc(result.feasibility.conditions.join('; '))}</p>` : '');
      const vl = { seniority: 'Seniority step', pathway: 'Pathway priority', institution: 'Institutional exposure', contribution: 'Strategic contribution', contract: 'Contract terms' };
      $('#wsValue').innerHTML = Object.keys(vl).map((k) => bar(`${vl[k]} · ${result.careerValue.weights[k]}%`, result.careerValue.parts[k])).join('') +
        (F.compensation && F.compensation.value ? `<p class="ws-small">Stated compensation: ${esc(F.compensation.value)}</p>` : '<p class="ws-small">Compensation not stated — not scored.</p>');

      $('#wsComps').innerHTML = result.competencies.length ? `<div class="ws-table-wrap"><table class="ws-table"><thead><tr><th>Competency</th><th>Demand</th><th>Strength</th><th>Best evidence</th></tr></thead><tbody>${result.competencies.map((c) => `
        <tr><td>${esc(c.label)}${c.evidence.length ? `<div class="ws-small">${esc(c.evidence.slice(0, 3).map((id) => (ev.byId[id] || {}).title || id).join('; '))}</div>` : ''}</td><td class="num">${c.weight}%</td><td class="num ${tone(c.strength)}">${c.strength}</td><td>${levelBadge(c.level)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="ws-muted">No competencies recognized.</p>';

      $('#wsGaps').innerHTML = result.gaps.length ? `<ul class="ws-list">${result.gaps.map((g) => `<li><span>${badge(g.severity, g.severity)} ${badge('', g.type + ' gap')} <strong>${esc(g.label)}</strong><br><span class="ws-small">${esc(g.detail)}</span><br><span class="ws-small"><b>Response:</b> ${esc(g.action)}</span></span>${g.type === 'eligibility' ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-action="gap-to-plan" data-gap="${esc(g.id)}">Plan</button>`}</li>`).join('')}</ul>` : '<p class="ws-note ok">No material gaps detected by the rules. Still read the posting for requirements the parser may miss.</p>';

      const pp = result.positioning;
      $('#wsPath').innerHTML = pp.primary && pp.primary.share > 0
        ? `<p><strong>${esc(pp.primary.label)}</strong> — position as <em>${esc(pp.primary.positioning)}</em> <span class="ws-small">(${Math.round(pp.primary.share * 100)}% of demand)</span></p>${pp.alternatives.length ? `<p class="ws-small">Also relevant: ${esc(pp.alternatives.map((a) => `${a.label} (${Math.round(a.share * 100)}%)`).join(' · '))}</p>` : ''}`
        : '<p class="ws-muted">No pathway recognized from the posting.</p>';
      $('#wsProjects').innerHTML = result.projects.length ? `<ul class="ws-list">${result.projects.map((p) => `<li><span><strong>${esc(p.title)}</strong>${p.year ? ` (${esc(p.year)})` : ''}<br><span class="ws-small">${esc(p.shared.join(', '))}${p.role ? '' : ' · role not recorded'}</span></span><span class="ws-badge">${p.score}</span></li>`).join('')}</ul>` : '<p class="ws-muted">No documented project shares the required competencies.</p>';
      $('#wsCvs').innerHTML = `<div class="ws-table-wrap"><table class="ws-table"><thead><tr><th>CV version</th><th>Match index</th><th>Why · customize</th></tr></thead><tbody>${result.cvs.slice(0, 5).map((c, i) => `
        <tr><td><a href="Alvin_Silva_CV_Versions/${encodeURIComponent(c.file)}" target="_blank" rel="noopener">${esc(c.file.replace(/^Alvin_Silva_|_CV\.pdf$/g, '').replace(/[-_]/g, ' '))}</a>${i === 0 ? ' ' + badge('pursue', 'recommended') : ''}<div class="ws-small">${esc(c.disciplines.join(' · '))}</div></td>
        <td class="num">${c.score}</td><td class="ws-small">${c.covered.length ? 'Covers: ' + esc(c.covered.slice(0, 4).join(', ')) : 'Little overlap'}${c.advice.length ? '<br>' + c.advice.map((a) => '• ' + esc(a)).join('<br>') : ''}</td></tr>`).join('')}</tbody></table></div><p class="ws-small">Match index is relative across your CV versions, not an absolute fit score.</p>`;

      renderClaims();
      composeLetter();
      $('#wsSaveNote').textContent = current.recordId ? 'Updates the saved record with this assessment.' : 'Saves to this browser' + (S.sync.state().status === 'synced' ? ' and your private backend.' : '. Export a backup regularly.');
    }

    function bar(label, n, why) {
      return `<div class="ws-bar"><span>${esc(label)}</span><div class="track" role="img" aria-label="${esc(label)}: ${n} of 100"><div class="fill ${tone(n)}" style="width:${Math.max(2, n)}%"></div></div><span class="n">${n}</span>${why ? `<span class="why">${esc(why)}</span>` : ''}</div>`;
    }

    function renderClaims() {
      const groups = { metric: 'Profile figures', project: 'Project evidence', credential: 'Qualifications', publication: 'Publications' };
      $('#wsClaims').innerHTML = Object.keys(groups).map((g) => {
        const list = current.claims.filter((c) => c.group === g);
        if (!list.length) return '';
        return `<div class="ws-small" style="margin:.5rem 0 .3rem;font-weight:600">${esc(groups[g])}</div>` + list.map((c) => `
          <label class="ws-claim"><input type="checkbox" data-claim="${esc(c.id)}" ${c.selected ? 'checked' : ''}><span><span>${esc(c.text)}</span>
          <span class="meta">${levelBadge(c.level)}<span class="ws-small">${esc(c.source)}</span></span>${c.warning ? `<span class="warn">⚠ ${esc(c.warning)}</span>` : ''}</span></label>`).join('');
      }).join('');
    }
    function composeLetter() {
      const letter = E.composeLetter(current.job, current.result, raw, current.claims, { tone: $('#wsTone').value, acknowledgeGaps: $('#wsAckGaps').checked });
      $('#wsLetter').value = letter;
    }

    function saveOpportunity() {
      if (!current) return;
      const { job, result } = current;
      const F = job.fields;
      const existing = current.recordId ? S.get(current.recordId) : null;
      const candidate = {
        id: existing ? existing.id : undefined,
        createdAt: existing ? existing.createdAt : undefined,
        source: { url: current.url || (existing && existing.source.url) || '', text: job.text, retrievedAt: (existing && existing.source.retrievedAt) || current.retrievedAt || null },
        job: {
          title: F.title.value || '', organization: F.organization.value || '', location: F.location.value || '',
          sector: F.sector.value || '', deadline: F.deadline.value || '', deadlineRaw: F.deadline.raw || '',
          employmentType: F.employmentType.value || '', seniority: F.seniority.value || null, requiredYears: F.requiredYears.value || null,
          degreeLevel: F.degreeLevel.value || null, compensation: F.compensation.value || '', duration: F.duration.value || '', remote: F.remote.value || ''
        },
        edits: current.edits,
        assessment: {
          modelVersion: result.modelVersion, assessedAt: result.assessedAt, inputHash: result.inputHash, credentialsHash: result.credentialsHash,
          alignment: result.alignment.score, feasibility: result.feasibility.score, careerValue: result.careerValue.score,
          confidence: result.confidence.score, confidenceLabel: result.confidence.label, eligibility: result.eligibility.status,
          decision: result.decision.code, decisionLabel: result.decision.label, timePriority: result.timePriority.code,
          pathway: result.positioning.primary && result.positioning.primary.share > 0 ? result.positioning.primary.id : null,
          parts: result.alignment.parts,
          gaps: result.gaps.map((g) => ({ id: g.id, competency: g.competency, label: g.label, type: g.type, severity: g.severity, action: g.action })),
          competencies: result.competencies.slice(0, 8).map((c) => ({ id: c.id, label: c.label, weight: c.weight, strength: c.strength }))
        },
        cv: result.cvs[0] ? result.cvs[0].file : '',
        coverLetter: $('#wsLetter').value,
        claimsUsed: current.claims.filter((c) => c.selected).map((c) => ({ id: c.id, level: c.level })),
        application: existing ? existing.application : S.blankApplication(result.decision.code === 'pursue' ? 'Shortlisted' : 'Assessing')
      };
      if (!existing) {
        candidate.application.documents = result.feasibility.documents.map((d) => ({ id: d.id, label: d.label, status: d.readiness === 'ready' || d.readiness === 'generated' ? 'ready' : 'needed' }));
        const dup = S.findDuplicate(candidate);
        if (dup && !root.confirm(`A record for “${dup.job.title}” at ${dup.job.organization} already exists. Save a separate record anyway? (Cancel to update the existing one.)`)) {
          candidate.id = dup.id; candidate.createdAt = dup.createdAt; candidate.application = dup.application;
        }
      } else {
        S.addEvent(existing.id, 'reassessed', { modelVersion: result.modelVersion, alignment: result.alignment.score });
        candidate.application = S.get(existing.id).application;
      }
      try {
        const rec = S.upsert(candidate);
        current.recordId = rec.id;
        toast('Saved to the pipeline.');
        $('#wsSaveNote').textContent = 'Saved. Further saves update this record.';
        updateCounts();
      } catch (e) { toast('Could not save: ' + (S.lastError() || e.message), true); }
    }

    async function fetchUrl() {
      const input = $('#wsUrl');
      let url;
      try { url = new URL(input.value.trim()); } catch (_) { toast('Enter a complete URL starting with https://', true); return; }
      if (!/^https?:$/.test(url.protocol)) { toast('Only http(s) links can be fetched.', true); return; }
      const btn = $('#wsFetchBtn');
      const note = $('#wsFetchNote');
      btn.disabled = true; note.textContent = 'Retrieving…';
      const endpoint = S.sync.extractEndpoint();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        let text = '', title = '';
        if (endpoint) {
          const res = await fetch(endpoint, { method: 'POST', headers: await S.sync.authHeaders(), body: JSON.stringify({ url: url.href }), signal: controller.signal });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
          text = data.text || ''; title = data.title || '';
        } else {
          const res = await fetch(url.href, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const ct = res.headers.get('content-type') || '';
          if (!/text\/html|text\/plain/.test(ct)) throw new Error('not an HTML page (' + ct + ')');
          const html = (await res.text()).slice(0, 1500000);
          const d = new DOMParser().parseFromString(html, 'text/html');
          d.querySelectorAll('script,style,noscript,nav,footer,header,svg').forEach((n) => n.remove());
          const node = ['[class*="job-description"]', '[class*="jobDescription"]', '[itemprop="description"]', 'article', 'main', '[role="main"]'].map((s) => d.querySelector(s)).find((n) => n && n.textContent.trim().length > 300) || d.body;
          text = (node ? node.innerText || node.textContent : '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
          title = (d.querySelector('title') || {}).textContent || '';
        }
        if (text.length < 200) throw new Error('the page returned too little text (it may load content with JavaScript or require sign-in)');
        $('#wsText').value = (title && !text.startsWith(title.trim()) ? title.trim() + '\n\n' : '') + text.slice(0, 20000);
        current = null;
        updateWordCount();
        note.textContent = `Retrieved ${new Date().toLocaleString()} via ${endpoint ? 'the retrieval service' : 'the browser'}. Treat the text as untrusted and check it before analyzing.`;
        toast('Posting text retrieved.');
      } catch (e) {
        note.textContent = (e.name === 'AbortError' ? 'Timed out.' : `Could not retrieve: ${e.message}.`) + (endpoint ? '' : ' Job sites usually block in-browser requests (CORS, sign-in, scripts). Paste the text, or configure the retrieval service in Settings.');
      } finally {
        clearTimeout(timer);
        btn.disabled = false;
      }
    }
    function updateWordCount() { const t = $('#wsText').value.trim(); $('#wsTextCount').textContent = String(t ? t.split(/\s+/).length : 0); }

    /* ======================================================== APPLICATIONS */
    function renderApps() {
      const q = ($('#wsAppSearch').value || '').toLowerCase();
      const filter = $('#wsAppStatus').value;
      const sort = $('#wsAppSort').value;
      let list = S.all().filter((o) => filter === 'all' ? true : filter === 'closed' ? isClosed(o) : !isClosed(o))
        .filter((o) => !q || (o.job.title + ' ' + o.job.organization).toLowerCase().includes(q));
      const key = { deadline: (o) => o.job.deadline || '9999', updated: (o) => -new Date(o.updatedAt).getTime(), alignment: (o) => -((o.assessment && o.assessment.alignment) || 0), value: (o) => -((o.assessment && o.assessment.careerValue) || 0) }[sort];
      list.sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; });
      if (!list.length) { $('#wsApps').innerHTML = `<div class="ws-empty">${S.all().length ? 'No records match these filters.' : 'No opportunities yet. Assess a posting or log one in Discover.'}</div>`; return; }
      $('#wsApps').innerHTML = `<div class="ws-table-wrap"><table class="ws-table"><thead><tr><th>Position · organization</th><th>Deadline</th><th>Status</th><th>Align</th><th>Feas.</th><th>Value</th><th></th></tr></thead><tbody>${list.map((o) => {
        const a = o.assessment || {};
        const d = daysUntil(o.job.deadline);
        const dl = o.job.deadline ? `${fmtDate(o.job.deadline)}${!isClosed(o) && d != null ? `<div class="ws-small ${d < 0 ? 'tone-low' : d <= 7 ? 'tone-mid' : ''}">${d < 0 ? 'passed' : d + ' d'}</div>` : ''}` : esc(o.job.deadlineRaw || '—');
        const sc = (n) => n == null ? '<span class="ws-small">—</span>' : `<span class="${tone(n)}">${n}</span>`;
        return `<tr><td><button class="ws-link" type="button" data-action="open-record" data-id="${esc(o.id)}">${esc(o.job.title || 'Untitled')}</button><div class="ws-small">${esc(o.job.organization || '')}${a.eligibility === 'likely ineligible' ? ' · ' + badge('bad', 'eligibility') : ''}${a.modelVersion && a.modelVersion !== E.MODEL_VERSION ? ' · ' + badge('unknown', a.modelVersion) : ''}</div></td>
          <td>${dl}</td>
          <td><label class="sr-only" for="st-${esc(o.id)}">Status</label><select id="st-${esc(o.id)}" data-action="set-status" data-id="${esc(o.id)}">${S.STATUSES.map((s) => `<option ${o.application.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></td>
          <td class="num">${sc(a.alignment != null ? a.alignment : a.legacyScore)}</td><td class="num">${sc(a.feasibility)}</td><td class="num">${sc(a.careerValue)}</td>
          <td><button class="btn btn-ghost btn-sm" type="button" data-action="open-record" data-id="${esc(o.id)}">Open</button></td></tr>`;
      }).join('')}</tbody></table></div><p class="ws-small" style="margin-top:.5rem">Grey version tags mark scores from an older model — re-assess to compare like with like.</p>`;
    }

    function openRecord(id) {
      const o = S.get(id);
      if (!o) return;
      const a = o.assessment || {};
      const ap = o.application;
      const dlg = $('#wsDialog');
      $('#wsDialogTitle').textContent = (o.job.title || 'Untitled') + (o.job.organization ? ' — ' + o.job.organization : '');
      const list = (arr, fn, empty) => arr && arr.length ? arr.map(fn).join('') : `<p class="ws-small">${empty}</p>`;
      $('#wsDialogBody').innerHTML = `
        <div class="ws-grid cols-3">
          <div class="ws-kpi"><strong class="${tone(a.alignment || 0)}">${a.alignment != null ? a.alignment : a.legacyScore != null ? a.legacyScore + '*' : '—'}</strong><span>Alignment</span>${a.legacyScore != null && a.alignment == null ? '<small>*legacy score, not comparable</small>' : ''}</div>
          <div class="ws-kpi"><strong class="${tone(a.feasibility || 0)}">${a.feasibility != null ? a.feasibility : '—'}</strong><span>Feasibility</span></div>
          <div class="ws-kpi"><strong class="${tone(a.careerValue || 0)}">${a.careerValue != null ? a.careerValue : '—'}</strong><span>Career value</span></div>
        </div>
        ${a.decisionLabel ? `<p class="ws-note ${a.decision === 'pursue' ? 'ok' : a.decision === 'ineligible' ? 'bad' : 'warn'}">${esc(a.decisionLabel)} · eligibility: ${esc(a.eligibility || '—')} · ${esc(a.modelVersion || '')}${a.assessedAt ? ' · ' + fmtDate(a.assessedAt) : ''}</p>` : ''}
        <form id="wsRecForm" data-id="${esc(o.id)}" autocomplete="off">
          <div class="ws-grid cols-3">
            <div class="ws-field"><label class="ws-label" for="rTitle">Position</label><input class="ws-input" id="rTitle" name="job.title" value="${esc(o.job.title)}"></div>
            <div class="ws-field"><label class="ws-label" for="rOrg">Organization</label><input class="ws-input" id="rOrg" name="job.organization" value="${esc(o.job.organization)}"></div>
            <div class="ws-field"><label class="ws-label" for="rDl">Deadline</label><input class="ws-input" id="rDl" name="job.deadline" type="date" value="${esc(o.job.deadline || '')}"></div>
            <div class="ws-field"><label class="ws-label" for="rStatus">Status</label><select class="ws-select" id="rStatus" name="status">${S.STATUSES.map((s) => `<option ${ap.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
            <div class="ws-field"><label class="ws-label" for="rSub">Submitted on</label><input class="ws-input" id="rSub" name="application.submittedAt" type="date" value="${esc(ap.submittedAt || '')}"></div>
            <div class="ws-field"><label class="ws-label" for="rUrl">Posting URL</label><input class="ws-input" id="rUrl" name="source.url" type="url" value="${esc(o.source.url || '')}"></div>
          </div>
          <h4>Documents</h4>
          <div id="rDocs">${list(ap.documents, (d, i) => `<label class="ws-check"><input type="checkbox" data-doc="${i}" ${d.status === 'ready' || d.status === 'submitted' ? 'checked' : ''}> ${esc(d.label)} <span class="ws-small">(${esc(d.status)})</span></label>`, 'No document checklist (assess the posting to create one).')}</div>
          <h4>Contacts</h4>
          <div>${list(ap.contacts, (c, i) => `<div class="ws-row"><span class="grow">${esc(c.name)}${c.role ? ' · ' + esc(c.role) : ''}${c.email ? ` · <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}</span><button class="ws-link" type="button" data-action="rec-del" data-list="contacts" data-index="${i}">Remove</button></div>`, 'No contacts.')}</div>
          <div class="ws-row"><input class="ws-input grow" name="new.contact.name" placeholder="Name" aria-label="Contact name"><input class="ws-input grow" name="new.contact.role" placeholder="Role" aria-label="Contact role"><input class="ws-input grow" name="new.contact.email" type="email" placeholder="E-mail" aria-label="Contact e-mail"></div>
          <h4>Follow-ups</h4>
          <div>${list(ap.followUps, (f, i) => `<div class="ws-row"><label class="ws-check grow"><input type="checkbox" data-follow="${i}" ${f.done ? 'checked' : ''}> ${fmtDate(f.date)} — ${esc(f.note || '')}</label><button class="ws-link" type="button" data-action="rec-ics" data-kind="follow" data-index="${i}">.ics</button><button class="ws-link" type="button" data-action="rec-del" data-list="followUps" data-index="${i}">Remove</button></div>`, 'No follow-ups.')}</div>
          <div class="ws-row"><input class="ws-input" name="new.follow.date" type="date" aria-label="Follow-up date" style="width:auto"><input class="ws-input grow" name="new.follow.note" placeholder="Follow-up note" aria-label="Follow-up note"></div>
          <h4>Interviews</h4>
          <div>${list(ap.interviews, (iv, i) => `<div class="ws-row"><span class="grow">${fmtDate(iv.date)} · ${esc(iv.stage || '')}${iv.notes ? ' — ' + esc(iv.notes) : ''}</span><button class="ws-link" type="button" data-action="rec-del" data-list="interviews" data-index="${i}">Remove</button></div>`, 'No interviews recorded.')}</div>
          <div class="ws-row"><input class="ws-input" name="new.iv.date" type="date" aria-label="Interview date" style="width:auto"><input class="ws-input" name="new.iv.stage" placeholder="Stage (e.g., panel)" aria-label="Interview stage" style="width:auto"><input class="ws-input grow" name="new.iv.notes" placeholder="Notes / questions asked" aria-label="Interview notes"></div>
          <h4>Notes</h4>
          <label class="sr-only" for="rNotes">Notes</label><textarea class="ws-textarea" id="rNotes" name="application.notes" rows="3">${esc(ap.notes || '')}</textarea>
          <div class="ws-grid cols-2">
            <div class="ws-field"><label class="ws-label" for="rSal">Salary expectation (private)</label><input class="ws-input" id="rSal" name="application.salaryExpectation" value="${esc(ap.salaryExpectation || '')}"><span class="ws-small">Kept with this record only; excluded from CSV export.</span></div>
            <div class="ws-field"><label class="ws-label" for="rOut">Outcome</label><select class="ws-select" id="rOut" name="application.outcome.result">${['', 'Offer accepted', 'Offer declined', 'Rejected after review', 'Rejected after interview', 'Withdrawn', 'No response'].map((x) => `<option ${ap.outcome.result === x ? 'selected' : ''} value="${esc(x)}">${esc(x || '— pending —')}</option>`).join('')}</select></div>
          </div>
          <div class="ws-grid cols-2">
            <div class="ws-field"><label class="ws-label" for="rReason">Reason given / inferred</label><textarea class="ws-textarea" id="rReason" name="application.outcome.reason" rows="2">${esc(ap.outcome.reason || '')}</textarea></div>
            <div class="ws-field"><label class="ws-label" for="rLessons">Lessons learned</label><textarea class="ws-textarea" id="rLessons" name="application.outcome.lessons" rows="2">${esc(ap.outcome.lessons || '')}</textarea></div>
          </div>
          <div class="ws-row" style="margin-top:.6rem"><button class="btn btn-primary btn-sm" type="submit">Save changes</button>
            <button class="btn btn-ghost btn-sm" type="button" data-action="rec-ics" data-kind="deadline">Deadline → .ics</button>
            ${o.source.text ? `<button class="btn btn-ghost btn-sm" type="button" data-action="assess-record" data-id="${esc(o.id)}">Re-assess</button>` : '<span class="ws-small">Posting text not kept — paste it in Assess to re-score.</span>'}
            ${o.coverLetter ? `<button class="btn btn-ghost btn-sm" type="button" data-action="rec-copy-letter">Copy letter</button>` : ''}
            <span class="grow"></span><button class="btn btn-danger btn-sm" type="button" data-action="rec-delete">Delete</button></div>
        </form>
        <h4>History</h4>
        <ol class="ws-timeline">${ap.events.slice().reverse().map((e) => `<li><span class="ws-small">${new Date(e.at).toLocaleString()}</span><br>${e.type === 'status' ? `Status → <strong>${esc(e.to)}</strong>${e.from ? ` (from ${esc(e.from)})` : ''}` : e.type === 'reassessed' ? `Re-assessed (${esc(e.modelVersion)}, alignment ${esc(e.alignment)})` : esc(e.type)}${e.note ? ' — ' + esc(e.note) : ''}</li>`).join('')}</ol>`;
      if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
    }

    function setPath(obj, path, value) { const ks = path.split('.'); let o = obj; ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; }); o[ks[ks.length - 1]] = value; }
    function saveRecordForm(form) {
      const id = form.dataset.id;
      const o = S.get(id);
      if (!o) return;
      const fd = new FormData(form);
      const newStatus = fd.get('status');
      ['job.title', 'job.organization', 'job.deadline', 'application.submittedAt', 'source.url', 'application.notes', 'application.salaryExpectation', 'application.outcome.result', 'application.outcome.reason', 'application.outcome.lessons'].forEach((k) => setPath(o, k, String(fd.get(k) || '').trim()));
      $$('[data-doc]', form).forEach((c) => { const d = o.application.documents[+c.dataset.doc]; if (d) d.status = c.checked ? (d.status === 'submitted' ? 'submitted' : 'ready') : 'needed'; });
      $$('[data-follow]', form).forEach((c) => { const f = o.application.followUps[+c.dataset.follow]; if (f) f.done = c.checked; });
      const cn = String(fd.get('new.contact.name') || '').trim();
      if (cn) o.application.contacts.push({ name: cn, role: String(fd.get('new.contact.role') || '').trim(), email: String(fd.get('new.contact.email') || '').trim() });
      const fdte = String(fd.get('new.follow.date') || '');
      if (fdte) o.application.followUps.push({ date: fdte, note: String(fd.get('new.follow.note') || '').trim(), done: false });
      const ivd = String(fd.get('new.iv.date') || '');
      if (ivd) { o.application.interviews.push({ date: ivd, stage: String(fd.get('new.iv.stage') || '').trim(), notes: String(fd.get('new.iv.notes') || '').trim() }); }
      S.upsert(o);
      if (ivd && !['Interview', 'Offer', 'Accepted'].includes(o.application.status) && newStatus === o.application.status) S.setStatus(id, 'Interview', 'Interview recorded');
      else if (newStatus && newStatus !== o.application.status) S.setStatus(id, newStatus);
      toast('Record saved.');
      openRecord(id);
      rerenderActive();
    }

    /* ---------------------------------------------------------------- ICS */
    function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
    function icsEvent(uidv, date, summary, desc) {
      const d = date.replace(/-/g, '');
      const next = new Date(date + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + 1);
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
      return ['BEGIN:VEVENT', `UID:${uidv}@cioms.asilvainnovations.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`, `SUMMARY:${icsEscape(summary)}`, `DESCRIPTION:${icsEscape(desc)}`, 'BEGIN:VALARM', 'TRIGGER:-P2D', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(summary)}`, 'END:VALARM', 'END:VEVENT'].join('\r\n');
    }
    function ics(events) { return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ASilva Innovations//CIOMS//EN', 'CALSCALE:GREGORIAN'].concat(events).concat(['END:VCALENDAR']).join('\r\n') + '\r\n'; }
    function exportAllIcs() {
      const ev2 = [];
      S.all().filter((o) => !isClosed(o)).forEach((o) => {
        if (o.job.deadline) ev2.push(icsEvent('dl-' + o.id, o.job.deadline, `Deadline: ${o.job.title} (${o.job.organization})`, o.source.url || ''));
        (o.application.followUps || []).filter((f) => !f.done && f.date).forEach((f, i) => ev2.push(icsEvent(`fu-${o.id}-${i}`, f.date, `Follow up: ${o.job.organization}`, f.note || '')));
      });
      if (!ev2.length) { toast('No open deadlines or follow-ups to export.'); return; }
      download('cioms-deadlines.ics', ics(ev2), 'text/calendar;charset=utf-8');
    }

    /* ============================================================ EVIDENCE */
    function renderEvidence() {
      if (!ev) { $('#wsEvidence').innerHTML = '<p class="ws-muted">Credentials not loaded.</p>'; return; }
      const q = ev.dataQuality;
      const pct = (n) => Math.round(100 * n / Math.max(1, q.projects));
      $('#wsQuality').innerHTML = `<div class="ws-grid cols-4">
        <div class="ws-kpi"><strong class="${tone(pct(q.withDescription))}">${q.withDescription}/${q.projects}</strong><span>projects with a description</span></div>
        <div class="ws-kpi"><strong class="${tone(pct(q.withRole))}">${q.withRole}/${q.projects}</strong><span>projects with your role recorded</span></div>
        <div class="ws-kpi"><strong class="${tone(pct(q.withClient))}">${q.withClient}/${q.projects}</strong><span>projects with a client recorded</span></div>
        <div class="ws-kpi"><strong class="${q.hasLanguages ? 'tone-high' : 'tone-low'}">${q.hasLanguages ? 'Yes' : 'No'}</strong><span>languages recorded</span></div></div>
        ${q.withRole < q.projects ? `<p class="ws-note warn">Letters can only describe work, not your position on it, for ${q.projects - q.withRole} projects. Add <code>role</code>, <code>client</code> and <code>description</code> to those entries in credentials.json to unlock stronger, still-truthful claims.</p>` : ''}
        ${q.expiredCertifications.length ? `<p class="ws-note bad">Expired: ${esc(q.expiredCertifications.join('; '))} — excluded from evidence strength and never presented as current.</p>` : ''}
        ${ev.unverifiedMetrics.length ? `<p class="ws-note warn">Marked unverified in credentials.json: ${esc(ev.unverifiedMetrics.join(', '))} — off by default in letters.</p>` : ''}`;
      const rows = E.TAXONOMY.filter((t) => t.id !== 'unmapped').map((t) => ({ t, s: Math.round(100 * (ev.strength[t.id] || 0)), n: (ev.byCompetency[t.id] || []).length, lvl: ev.bestLevel[t.id] })).sort((a, b) => b.s - a.s);
      $('#wsStrength').innerHTML = rows.map((r) => `<div class="ws-bar"><span>${esc(r.t.label)} <span class="ws-small">· ${r.n} record(s)</span> ${levelBadge(r.lvl || 'unknown')}</span><div class="track"><div class="fill ${tone(r.s)}" style="width:${Math.max(2, r.s)}%"></div></div><span class="n">${r.s}</span></div>`).join('');
      const compSel = $('#wsEvComp');
      if (compSel.options.length <= 1) compSel.insertAdjacentHTML('beforeend', E.TAXONOMY.filter((t) => t.id !== 'unmapped').map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join(''));
      const kind = $('#wsEvKind').value, comp = compSel.value;
      const items = ev.items.filter((i) => (!kind || i.kind === kind) && (!comp || i.competencies.includes(comp)));
      $('#wsEvidence').innerHTML = items.length ? `<div class="ws-table-wrap"><table class="ws-table"><thead><tr><th>Record</th><th>Type</th><th>Level</th><th>Competencies</th></tr></thead><tbody>${items.map((i) => `
        <tr><td><strong>${esc(i.title)}</strong>${i.client ? `<div class="ws-small">${esc(i.client)}</div>` : ''}${i.year ? `<div class="ws-small">${esc(i.year)}</div>` : ''}${i.kind === 'project' && !i.role ? '<div class="ws-small tone-mid">role not recorded</div>' : ''}${i.status === 'expired' ? `<div class="ws-small tone-low">expired ${esc(i.expires || '')}</div>` : ''}${i.verifyUrl ? `<div class="ws-small"><a href="${esc(i.verifyUrl)}" target="_blank" rel="noopener noreferrer">verify</a></div>` : ''}</td>
        <td class="ws-small">${esc(i.kind)}${i.years ? ` · ${i.years} yrs` : ''}</td><td>${levelBadge(i.level)}</td>
        <td class="ws-small">${esc(i.competencies.map((c) => (E.TAXONOMY.find((t) => t.id === c) || {}).label + (i.links && i.links[c] === 'weak' ? ' (inferred)' : '')).join(', ') || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="ws-muted">No records match.</p>';
    }

    /* ========================================================= DEVELOPMENT */
    function renderDevelopment() {
      const agg = {};
      S.all().forEach((o) => ((o.assessment && o.assessment.gaps) || []).filter((g) => g.type === 'competency' || g.type === 'evidence' || g.type === 'credential').forEach((g) => {
        const k = (g.competency || g.label) + '|' + g.type;
        agg[k] = agg[k] || { key: k, label: g.label, type: g.type, competency: g.competency, action: g.action, count: 0, severe: 0, sources: [] };
        agg[k].count++; if (g.severity !== 'minor') agg[k].severe++; agg[k].sources.push(o.id);
      }));
      const rec = Object.values(agg).sort((a, b) => b.severe - a.severe || b.count - a.count);
      const planned = new Set(S.devplan().map((d) => (d.competency || d.label) + '|' + d.type));
      $('#wsRecurring').innerHTML = rec.length ? `<ul class="ws-list">${rec.slice(0, 12).map((g) => `<li><span>${badge('', g.type + ' gap')} <strong>${esc(g.label)}</strong> <span class="ws-small">in ${g.count} opportunit${g.count === 1 ? 'y' : 'ies'}${g.severe ? `, ${g.severe} major` : ''}</span><br><span class="ws-small">${esc(g.action)}</span></span>${planned.has(g.key) ? badge('met', 'planned') : `<button class="btn btn-ghost btn-sm" type="button" data-action="agg-to-plan" data-key="${esc(g.key)}">Plan</button>`}</li>`).join('')}</ul>` : '<p class="ws-muted">Save assessed opportunities to see recurring gaps.</p>';
      root.__ciomsAgg = agg;
      const plan = S.devplan();
      $('#wsPlan').innerHTML = plan.length ? `<div class="ws-table-wrap"><table class="ws-table"><thead><tr><th>Gap · action</th><th>Type</th><th>Status</th><th>Target</th><th></th></tr></thead><tbody>${plan.map((d) => `
        <tr><td><strong>${esc(d.label)}</strong><div class="ws-small">${esc(d.action)}</div><label class="sr-only" for="dn-${esc(d.id)}">Evidence or reassessment note</label><input class="ws-input" id="dn-${esc(d.id)}" data-dev-note="${esc(d.id)}" value="${esc(d.note || '')}" placeholder="Evidence added / reassessment note" style="margin-top:.4rem"><div class="ws-small">${(d.sources || []).length} linked opportunit${(d.sources || []).length === 1 ? 'y' : 'ies'}</div></td>
        <td>${badge('', d.type)}</td>
        <td><label class="sr-only" for="ds-${esc(d.id)}">Status</label><select id="ds-${esc(d.id)}" data-dev-status="${esc(d.id)}">${['Planned', 'In progress', 'Done', 'Dropped'].map((s) => `<option ${d.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><label class="sr-only" for="dt-${esc(d.id)}">Target date</label><input class="ws-input" id="dt-${esc(d.id)}" type="date" data-dev-date="${esc(d.id)}" value="${esc(d.targetDate || '')}" style="width:auto"></td>
        <td><button class="ws-link" type="button" data-action="dev-remove" data-id="${esc(d.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div><p class="ws-small" style="margin-top:.5rem">When an evidence gap is done, update credentials.json and re-assess: the gap should close in the next assessment.</p>` : '<p class="ws-muted">No development actions yet. Use “Plan” on a gap.</p>';
    }

    /* =========================================================== ANALYTICS */
    function renderAnalytics() {
      const opps = S.all();
      if (!opps.length) { $('#wsAnalytics').innerHTML = '<div class="ws-card ws-empty">No records yet.</div>'; return; }
      const reached = (o, stage) => {
        const idx = S.STAGES.indexOf(stage);
        const hist = (o.application.events || []).filter((e) => e.type === 'status').map((e) => e.to).concat(o.application.status);
        return hist.some((s) => S.STAGES.indexOf(s) >= idx) || (stage === 'Applied' && !!o.application.submittedAt) || (stage === 'Interview' && (o.application.interviews || []).length > 0);
      };
      const n = opps.length;
      const assessed = opps.filter((o) => o.assessment && o.assessment.alignment != null).length;
      const qualified = opps.filter((o) => o.assessment && o.assessment.alignment >= 70 && o.assessment.eligibility !== 'likely ineligible').length;
      const applied = opps.filter((o) => reached(o, 'Applied')).length;
      const interview = opps.filter((o) => reached(o, 'Interview')).length;
      const offer = opps.filter((o) => reached(o, 'Offer')).length;
      const rate = (a, b) => b ? `${Math.round(100 * a / b)}%` : '—';
      const caution = (b) => b && b < 5 ? ' ' + badge('low', `n=${b}`) : '';
      const funnel = [['Identified', n, null], ['Assessed', assessed, n], ['Qualified', qualified, assessed], ['Applied', applied, qualified || assessed], ['Interview', interview, applied], ['Offer', offer, interview]];
      const max = Math.max(1, n);
      const group = (fn) => {
        const g = {};
        opps.forEach((o) => { const k = fn(o) || '—'; g[k] = g[k] || { k, n: 0, applied: 0, interview: 0 }; g[k].n++; if (reached(o, 'Applied')) g[k].applied++; if (reached(o, 'Interview')) g[k].interview++; });
        return Object.values(g).sort((a, b) => b.n - a.n);
      };
      const table = (title, rows) => `<div class="ws-card"><h3>${esc(title)}</h3><div class="ws-table-wrap"><table class="ws-table"><thead><tr><th>Group</th><th>Recorded</th><th>Applied</th><th>Interview</th><th>Interview rate (of applied)</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.k)}</td><td class="num">${r.n}</td><td class="num">${r.applied}</td><td class="num">${r.interview}</td><td class="num">${rate(r.interview, r.applied)}${caution(r.applied)}</td></tr>`).join('')}</tbody></table></div></div>`;
      const lead = opps.filter((o) => o.application.submittedAt && o.job.deadline).map((o) => Math.round((new Date(o.job.deadline) - new Date(o.application.submittedAt)) / 86400000));
      const avgLead = lead.length ? Math.round(lead.reduce((a, b) => a + b, 0) / lead.length) : null;
      const plan = S.devplan();
      const done = plan.filter((d) => d.status === 'Done').length;
      const months = {};
      opps.forEach((o) => { const m = (o.createdAt || '').slice(0, 7); if (m) months[m] = (months[m] || 0) + 1; });
      const monthRows = Object.keys(months).sort().slice(-12);
      const mmax = Math.max(1, ...Object.values(months));
      const alignByOutcome = (pred) => { const xs = opps.filter((o) => o.assessment && o.assessment.alignment != null && pred(o)).map((o) => o.assessment.alignment); return xs.length ? `${Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)} (n=${xs.length})` : '—'; };
      $('#wsAnalytics').innerHTML = `
        <div class="ws-grid cols-4">
          <div class="ws-kpi"><strong>${rate(applied, qualified || assessed)}</strong><span>Application conversion</span><small>${applied} applied of ${qualified || assessed} ${qualified ? 'qualified' : 'assessed'}</small></div>
          <div class="ws-kpi"><strong>${rate(interview, applied)}</strong><span>Interview conversion</span><small>${interview} of ${applied} applied${applied && applied < 5 ? ' · small n' : ''}</small></div>
          <div class="ws-kpi"><strong>${rate(offer, interview)}</strong><span>Offer conversion</span><small>${offer} of ${interview} interviewed</small></div>
          <div class="ws-kpi"><strong>${avgLead == null ? '—' : avgLead + ' d'}</strong><span>Avg. submission lead time</span><small>days before deadline · n=${lead.length}</small></div>
        </div>
        <div class="ws-grid cols-2" style="margin-top:1rem">
          <div class="ws-card"><h3>Funnel</h3>${funnel.map(([l, v, den]) => `<div class="ws-bar"><span>${esc(l)}${den != null ? ` <span class="ws-small">· ${rate(v, den)} of previous</span>` : ''}</span><div class="track"><div class="fill" style="width:${Math.max(2, Math.round(100 * v / max))}%"></div></div><span class="n">${v}</span></div>`).join('')}</div>
          <div class="ws-card"><h3>Opportunities recorded per month</h3>${monthRows.map((m) => `<div class="ws-bar"><span>${esc(m)}</span><div class="track"><div class="fill" style="width:${Math.round(100 * months[m] / mmax)}%"></div></div><span class="n">${months[m]}</span></div>`).join('') || '<p class="ws-muted">—</p>'}</div>
        </div>
        ${table('By sector', group((o) => o.job.sector ? o.job.sector[0].toUpperCase() + o.job.sector.slice(1) : 'Unspecified'))}
        ${table('By CV version (effectiveness)', group((o) => o.cv ? o.cv.replace(/^Alvin_Silva_|_CV\.pdf$/g, '').replace(/[-_]/g, ' ') : 'No CV recorded'))}
        ${table('By career pathway', group((o) => { const p = o.assessment && o.assessment.pathway; const pw = E.PATHWAYS.find((x) => x.id === p); return pw ? pw.label : 'Not assessed'; }))}
        <div class="ws-grid cols-2">
          <div class="ws-card"><h3>Model check</h3><p class="ws-small">Average alignment score by outcome. If interviewed roles do not score higher than rejected ones over time, the weights need recalibration — but outcomes also reflect competition and timing.</p>
            <ul class="ws-list"><li><span>Reached interview</span><span class="num">${alignByOutcome((o) => reached(o, 'Interview'))}</span></li><li><span>Applied, no interview</span><span class="num">${alignByOutcome((o) => reached(o, 'Applied') && !reached(o, 'Interview'))}</span></li><li><span>Not applied</span><span class="num">${alignByOutcome((o) => !reached(o, 'Applied'))}</span></li></ul></div>
          <div class="ws-card"><h3>Development gap closure</h3><div class="ws-kpi"><strong>${rate(done, plan.length)}</strong><span>${done} of ${plan.length} planned actions done</span></div></div>
        </div>`;
    }

    /* ============================================================ SETTINGS */
    function renderSettings() {
      const st = S.settings();
      const pf = $('#wsPathForm');
      pf.innerHTML = E.PATHWAYS.map((p) => { const v = st.pathwayPriorities[p.id] != null ? st.pathwayPriorities[p.id] : 3; return `<div class="ws-field"><label class="ws-label" for="pw-${p.id}"><span>${esc(p.label)}</span><span class="ws-badge" id="pwv-${p.id}">${v}${st.pathwayPriorities[p.id] == null ? ' (default)' : ''}</span></label><input type="range" min="1" max="5" step="1" id="pw-${p.id}" name="${p.id}" value="${v}" style="width:100%;accent-color:var(--gold)"><span class="ws-small">${esc(p.positioning)}</span></div>`; }).join('') + '<button class="btn btn-ghost btn-sm" type="submit">Save priorities</button>';
      const pr = $('#wsPrivacyForm');
      pr.storeSourceText.checked = !!st.storeSourceText; pr.storeLetters.checked = !!st.storeLetters;
      pr.retentionDays.value = st.retentionDays; pr.notifyDays.value = st.notifyDays;
      const sf = $('#wsSyncForm');
      sf.url.value = st.sync.url || ''; sf.anonKey.value = st.sync.anonKey || ''; sf.extractEndpoint.value = st.sync.extractEndpoint || '';
      const ss = S.sync.state();
      const sess = S.sync.session();
      $('#wsSyncState').textContent = ss.message + (sess && sess.email ? ` (${sess.email})` : '');
      const u = S.usage();
      $('#wsUsage').textContent = `${u.opportunities} opportunities and ${u.devplan} development actions · about ${Math.max(1, Math.round(u.bytes / 1024))} KB in this browser's storage. Browser storage can be cleared by the browser or other tools on this site — export a backup regularly.`;
      $('#wsLegacy').innerHTML = S.hasLegacyBackup() ? '<p class="ws-note">A backup of the pre-CIOMS tracker data is kept in this browser. <button class="ws-link" type="button" data-action="drop-legacy">Remove legacy backup</button></p>' : '';
      $('#wsSourceInfo').innerHTML = creds ? `<p class="ws-small">Source: <code>${esc(creds._source)}</code> · schema v${esc(creds.schemaVersion)} · ${raw.disciplines.length} disciplines, ${raw.projects.length} projects, ${raw.certifications.length} certifications, ${raw.cv_versions.length} CV versions · loaded ${new Date(creds.updated).toLocaleString()}</p>${creds._problems && creds._problems.length ? `<p class="ws-note warn">Schema problems: ${esc(creds._problems.join('; '))}</p>` : '<p class="ws-note ok">Schema checks passed.</p>'}` : '';
    }

    /* ==================================================== DATA & STARTUP */
    function engineCreds(c) {
      /* The engine reads the canonical collection names. ASilva.data already
         normalizes them; certifications carry runtime-evaluated status. */
      return { profile: c.profile, institutions: c.institutions, disciplines: c.disciplines, projects: c.projects, publications: c.publications,
        cv_versions: c.cv_versions, certifications: c.certifications, memberships: c.memberships, appointments: c.appointments, technical_training: c.technical_training };
    }
    async function loadData(force) {
      creds = force && ctx.data.reload ? await ctx.data.reload() : await ctx.data.load();
      raw = engineCreds(creds);
      ev = E.buildEvidenceIndex(raw);
      const chip = $('#wsDataStatus');
      if (creds._degraded) { chip.className = 'ws-chip bad'; chip.textContent = 'credentials.json unavailable — assessment disabled'; $('#wsAnalyzeBtn').disabled = true; }
      else if (creds._problems && creds._problems.length) { chip.className = 'ws-chip warn'; chip.textContent = `credentials.json loaded with ${creds._problems.length} schema warning(s)`; $('#wsAnalyzeBtn').disabled = false; }
      else { chip.className = 'ws-chip ok'; chip.textContent = `credentials.json · ${raw.projects.length} projects · ${raw.certifications.length} certifications`; $('#wsAnalyzeBtn').disabled = false; }
      $('#wsModelStatus').textContent = 'Model ' + E.MODEL_VERSION;
    }

    function bindEvents() {
      const onClick = async (e) => {
        const goto = e.target.closest('[data-goto]');
        if (goto) { showTab(goto.dataset.goto, { anchor: goto.dataset.anchor && !$('#wsResults').hidden ? goto.dataset.anchor : null }); return; }
        const el = e.target.closest('[data-action]');
        if (!el || el.tagName === 'SELECT') return;
        const act = el.dataset.action;
        const id = el.dataset.id;
        switch (act) {
          case 'analyze': analyze(); break;
          case 'reassess': reassess(); break;
          case 'clear-assess': $('#wsText').value = ''; $('#wsUrl').value = ''; $('#wsResults').hidden = true; current = null; updateWordCount(); $('#wsAssessContext').textContent = ''; break;
          case 'fetch-url': fetchUrl(); break;
          case 'copy-letter': copy($('#wsLetter').value); break;
          case 'download-letter': download(`letter-${E.slug((current && current.job.fields.organization.value) || 'draft')}.txt`, $('#wsLetter').value); break;
          case 'save-opportunity': saveOpportunity(); break;
          case 'gap-to-plan': {
            const g = current && current.result.gaps.find((x) => x.id === el.dataset.gap);
            if (g) { S.upsertDev({ competency: g.competency, label: g.label, type: g.type, action: g.action, sources: current.recordId ? [current.recordId] : [] }); toast('Added to the development plan.'); updateCounts(); el.replaceWith(Object.assign(doc.createElement('span'), { className: 'ws-badge met', textContent: 'planned' })); }
            break;
          }
          case 'agg-to-plan': { const g = (root.__ciomsAgg || {})[el.dataset.key]; if (g) { S.upsertDev({ competency: g.competency, label: g.label, type: g.type, action: g.action, sources: g.sources }); renderDevelopment(); updateCounts(); } break; }
          case 'dev-remove': if (await confirmDialog('Remove this development action?')) { S.removeDev(id); renderDevelopment(); updateCounts(); } break;
          case 'open-record': openRecord(id); break;
          case 'assess-record': {
            const o = S.get(id); if (!o) break;
            const dlg = $('#wsDialog'); if (dlg.open) dlg.close();
            $('#wsText').value = o.source.text || ''; $('#wsUrl').value = o.source.url || ''; updateWordCount();
            showTab('assess');
            if (o.source.text) analyze(o); else toast('Paste the posting text, then Analyze. Saving will update this record.');
            if (!o.source.text) current = { recordId: o.id };
            break;
          }
          case 'dialog-close': $('#wsDialog').close(); break;
          case 'rec-delete': {
            const fid = $('#wsRecForm').dataset.id;
            if (await confirmDialog('Delete this record permanently from this browser' + (S.sync.configured() ? ' and the private backend' : '') + '?')) { S.remove(fid); $('#wsDialog').close(); toast('Record deleted.'); rerenderActive(); }
            break;
          }
          case 'rec-del': {
            const fid = $('#wsRecForm').dataset.id; const o = S.get(fid);
            if (o) { o.application[el.dataset.list].splice(+el.dataset.index, 1); S.upsert(o); openRecord(fid); }
            break;
          }
          case 'rec-ics': {
            const o = S.get($('#wsRecForm').dataset.id); if (!o) break;
            if (el.dataset.kind === 'deadline') { if (!o.job.deadline) { toast('No deadline set.', true); break; } download(`deadline-${E.slug(o.job.organization || 'opportunity')}.ics`, ics([icsEvent('dl-' + o.id, o.job.deadline, `Deadline: ${o.job.title} (${o.job.organization})`, o.source.url || '')]), 'text/calendar;charset=utf-8'); }
            else { const f = o.application.followUps[+el.dataset.index]; if (f && f.date) download('follow-up.ics', ics([icsEvent(`fu-${o.id}-${el.dataset.index}`, f.date, `Follow up: ${o.job.organization}`, f.note || '')]), 'text/calendar;charset=utf-8'); }
            break;
          }
          case 'rec-copy-letter': { const o = S.get($('#wsRecForm').dataset.id); if (o) copy(o.coverLetter); break; }
          case 'export-csv': download(`cioms-opportunities-${new Date().toISOString().slice(0, 10)}.csv`, S.exportCSV(), 'text/csv;charset=utf-8'); break;
          case 'export-json': download(`cioms-backup-${new Date().toISOString().slice(0, 10)}.json`, S.exportJSON(), 'application/json'); break;
          case 'export-ics-all': exportAllIcs(); break;
          case 'remove-source': { const st = S.settings(); const list = st.sources || []; list.splice(+el.dataset.index, 1); S.setSettings({ sources: list }); renderDiscover(); break; }
          case 'notify-enable': if ('Notification' in root) { const p = await Notification.requestPermission(); if (p === 'granted') { toast('Reminders enabled for this device.'); notifyDue(); } renderOverview(); } break;
          case 'sync-now': S.sync.run(); break;
          case 'sign-out': S.sync.signOut(); renderSettings(); break;
          case 'drop-legacy': if (await confirmDialog('Remove the legacy tracker backup? Your migrated records are not affected.')) { S.dropLegacyBackup(); renderSettings(); } break;
          case 'reload-data': await loadData(true); toast('credentials.json reloaded.'); rerenderActive(); break;
          case 'clear-all':
            if (await confirmDialog('Delete ALL opportunities and development actions in this browser? Export a backup first. This cannot be undone.')) { S.clearAll(); toast('All records deleted.'); rerenderActive(); }
            break;
          default: break;
        }
      };
      /* The record <dialog> sits outside the mount; both share one handler. */
      mount.addEventListener('click', onClick);
      $('#wsDialog').addEventListener('click', onClick);

      mount.addEventListener('change', (e) => {
        const t = e.target;
        if (t.matches('select[data-action="set-status"]')) { S.setStatus(t.dataset.id, t.value); toast('Status updated.'); updateCounts(); return; }
        if (t.matches('[data-claim]')) { const c = current && current.claims.find((x) => x.id === t.dataset.claim); if (c) { c.selected = t.checked; composeLetter(); } return; }
        if (t.id === 'wsTone' || t.id === 'wsAckGaps') { if (current && current.result) composeLetter(); return; }
        if (t.matches('[data-dev-status]')) { const d = S.devplan().find((x) => x.id === t.dataset.devStatus); if (d) { S.upsertDev(Object.assign(d, { status: t.value })); updateCounts(); } return; }
        if (t.matches('[data-dev-date]')) { const d = S.devplan().find((x) => x.id === t.dataset.devDate); if (d) S.upsertDev(Object.assign(d, { targetDate: t.value })); return; }
        if (t.matches('[data-dev-note]')) { const d = S.devplan().find((x) => x.id === t.dataset.devNote); if (d) S.upsertDev(Object.assign(d, { note: t.value })); return; }
        if (t.id === 'wsAppStatus' || t.id === 'wsAppSort') { renderApps(); return; }
        if (t.id === 'wsEvKind' || t.id === 'wsEvComp') { renderEvidence(); return; }
        if (t.id === 'wsImport' && t.files && t.files[0]) {
          const f = t.files[0];
          if (f.size > 10 * 1024 * 1024) { toast('That file is too large for a CIOMS backup.', true); t.value = ''; return; }
          f.text().then((txt) => { const r = S.importJSON(txt); toast(`Imported: ${r.added} added, ${r.updated} updated.`); rerenderActive(); }).catch((err) => toast('Import failed: ' + err.message, true)).finally(() => { t.value = ''; });
        }
      });
      mount.addEventListener('input', (e) => {
        if (e.target.id === 'wsText') updateWordCount();
        if (e.target.id === 'wsAppSearch') renderApps();
        if (e.target.type === 'range' && e.target.closest('#wsPathForm')) { const b = $('#pwv-' + e.target.name); if (b) b.textContent = e.target.value; }
      });

      $('#wsSourceForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target; let url;
        try { url = new URL(f.url.value.trim()); if (!/^https?:$/.test(url.protocol)) throw new Error(); } catch (_) { toast('Enter a valid http(s) URL.', true); return; }
        const list = S.settings().sources || [];
        list.push({ name: f.name.value.trim().slice(0, 80), url: url.href, sector: 'Custom' });
        S.setSettings({ sources: list }); f.reset(); renderDiscover();
      });
      $('#wsCaptureForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target;
        const rec = { source: { url: f.url.value.trim(), text: '', retrievedAt: null }, job: { title: f.title.value.trim(), organization: f.organization.value.trim(), location: '', sector: '', deadline: f.deadline.value, deadlineRaw: '' }, assessment: null, cv: '', coverLetter: '', application: S.blankApplication('Discovered') };
        const dup = S.findDuplicate(rec);
        if (dup && !root.confirm(`“${dup.job.title}” at ${dup.job.organization} is already in the pipeline. Add another record?`)) return;
        S.upsert(rec); f.reset(); toast('Added to the pipeline as Discovered.'); updateCounts();
      });
      $('#wsPathForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const pri = {}; E.PATHWAYS.forEach((p) => { pri[p.id] = Number(e.target[p.id].value); });
        S.setSettings({ pathwayPriorities: pri }); toast('Career priorities saved. Re-assess to apply them.'); renderSettings();
      });
      $('#wsPrivacyForm').addEventListener('submit', (e) => {
        e.preventDefault(); const f = e.target;
        S.setSettings({ storeSourceText: f.storeSourceText.checked, storeLetters: f.storeLetters.checked, retentionDays: Math.max(0, Number(f.retentionDays.value) || 0), notifyDays: Math.min(60, Math.max(1, Number(f.notifyDays.value) || 7)) });
        const n = S.applyRetention(); toast('Privacy settings saved.' + (n ? ` Purged text from ${n} closed record(s).` : ''));
      });
      $('#wsSyncForm').addEventListener('submit', (e) => {
        e.preventDefault(); const f = e.target;
        const url = f.url.value.trim().replace(/\/$/, '');
        if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) { toast('Project URL should look like https://xxxx.supabase.co', true); return; }
        const ep = f.extractEndpoint.value.trim();
        if (ep) { try { if (new URL(ep).protocol !== 'https:') throw new Error(); } catch (_) { toast('Retrieval endpoint must be an https URL.', true); return; } }
        S.setSettings({ sync: { url, anonKey: f.anonKey.value.trim(), extractEndpoint: ep } });
        toast(url ? 'Backend configuration saved.' : 'Backend disabled — records stay in this browser.'); S.sync.run(); renderSettings();
      });
      $('#wsSignInForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value.trim();
        if (!email) return;
        try { await S.sync.signIn(email); toast('Check your inbox for the sign-in link.'); } catch (err) { toast('Sign-in failed: ' + err.message, true); }
        renderSettings();
      });
      $('#wsDialog').addEventListener('submit', (e) => { if (e.target.id === 'wsRecForm') { e.preventDefault(); saveRecordForm(e.target); } });
      $('#wsDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
      $('#wsDialog').addEventListener('close', () => rerenderActive());
      root.addEventListener('hashchange', () => { const m = (root.location.hash || '').match(/^#ws-([a-z]+)/); if (m) showTab(m[1], { noHash: true }); });
    }

    async function start() {
      S.load();
      bindTabs();
      bindEvents();
      S.subscribe((why) => { if (why === 'sync' || why === 'pulled' || why === 'error') { updateCounts(); if (why === 'pulled') rerenderActive(); if (why === 'error') toast(S.lastError() || 'Storage error', true); const ss = $('#wsSyncState'); if (ss) ss.textContent = S.sync.state().message; } });
      try { await loadData(false); }
      catch (e) { $('#wsDataStatus').className = 'ws-chip bad'; $('#wsDataStatus').textContent = 'Could not load credentials: ' + e.message; }
      S.sync.init();
      const purged = S.applyRetention();
      if (purged) toast(`Retention: removed stored text from ${purged} closed record(s).`);
      const m = (root.location.hash || '').match(/^#ws-([a-z]+)/);
      showTab(m ? m[1] : 'overview', { noHash: !m });
      notifyDue();
      ctx.bus.on('data:refreshed', () => { loadData(false).then(rerenderActive); });
      console.info(`[CIOMS] ${E.MODEL_VERSION} ready · ${S.all().length} records`);
    }

    return { start, analyze, get current() { return current; } };
  }
})(window);
