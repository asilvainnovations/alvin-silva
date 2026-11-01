/**
 * career-engine.js — CIOMS job-intelligence engine (D2).
 *
 * Pure functions, no DOM, no storage, no network. Loaded by boot.js on the
 * career workspace and by scripts/test-career-engine.mjs in CI, so the same
 * code that runs in the browser is the code that is tested.
 *
 * Pipeline
 *   1. extractJob()          structured fields + requirement statements,
 *                            each with a confidence and a source snippet
 *   2. buildEvidenceIndex()  credentials.json -> evidence items with an
 *                            evidence level (verified … inferred)
 *   3. assess()              eligibility checks (never auto-decided),
 *                            A. professional alignment, B. application
 *                            feasibility, C. career value, time priority,
 *                            gaps (competency vs evidence vs credential),
 *                            ranked CVs, career positioning, confidence
 *   4. buildClaims() / composeLetter()
 *                            every sentence in a letter comes from a claim
 *                            with a source and an evidence level
 *
 * Determinism: given the same text, credentials, settings, `today` and
 * MODEL_VERSION, assess() returns the same result. The result records an
 * input hash so a saved score can be reproduced later.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.ASilva = root.ASilva || {}; root.ASilva.careerEngine = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MODEL_VERSION = 'cioms-fit-3.0.0';

  /* -------------------------------------------------------------- weights */
  /* Starting weights from the 2026 architecture review; they need
     calibration against expert-assessed postings (see tests). */
  const ALIGNMENT_WEIGHTS = {
    mandatory: 15, competencies: 20, projects: 20, leadership: 15,
    sector: 10, geography: 5, evidence: 10, direction: 5
  };
  const FEASIBILITY_WEIGHTS = { time: 40, documents: 25, eligibility: 25, conditions: 10 };
  const VALUE_WEIGHTS = { seniority: 25, pathway: 30, institution: 20, contribution: 15, contract: 10 };

  const LEVELS = {
    verified: { w: 1.0, label: 'Verified', note: 'Supported by a verifiable document, credential ID or record' },
    documented: { w: 0.8, label: 'Documented', note: 'Supported by a project record, deliverable or CV' },
    'self-reported': { w: 0.55, label: 'Self-reported', note: 'Present in profile data but not independently verified' },
    inferred: { w: 0.3, label: 'Inferred', note: 'Suggested by keyword or semantic matching only' },
    unknown: { w: 0, label: 'Unknown', note: 'Insufficient information' }
  };

  /* ------------------------------------------------------------ taxonomy */
  /* Job terminology -> professional competency. Synonyms are matched as whole
     phrases on normalized text, so "climate risk management" and "climate
     change adaptation" land on the same competency. */
  const TAXONOMY = [
    { id: 'drr', label: 'Disaster risk reduction & management', synonyms: ['disaster risk', 'drr', 'drrm', 'disaster management', 'emergency preparedness', 'preparedness', 'ra 10121', 'sendai', 'early warning', 'emergency operations', 'eoc', 'contingency planning', 'hazard', 'risk reduction', 'disaster resilience', 'ndrrmc', 'drrmo', 'response and recovery', 'recovery and rehabilitation', 'incident command'] },
    { id: 'cca', label: 'Climate change adaptation', synonyms: ['climate change adaptation', 'climate adaptation', 'adaptation', 'climate risk', 'climate resilience', 'climate smart', 'cca', 'climate change', 'loss and damage', 'nature based solutions', 'lccap'] },
    { id: 'climate_finance', label: 'Climate & development finance', synonyms: ['climate finance', 'green finance', 'bankable', 'funder ready', 'people s survival fund', 'psf', 'investment appraisal', 'project financing', 'resource mobilization', 'blended finance', 'green climate fund', 'gcf'] },
    { id: 'strategy', label: 'Strategic planning', synonyms: ['strategic planning', 'strategic plan', 'strategy development', 'strategy formulation', 'roadmap', 'roadmapping', 'long term plan', 'medium term plan', 'vision', 'foresight', 'scenario planning', 'strategic direction', 'corporate planning', 'development plan', 'cdp'] },
    { id: 'policy', label: 'Policy analysis & advisory', synonyms: ['policy analysis', 'policy research', 'policy development', 'policy advice', 'policy advisory', 'policy', 'political economy', 'legislation', 'regulatory', 'policy brief', 'advocacy', 'public policy'] },
    { id: 'governance', label: 'Governance & organizational development', synonyms: ['governance', 'institutional strengthening', 'institutional development', 'organizational development', 'organisational development', 'change management', 'performance management', 'organizational effectiveness', 'adaptive governance', 'inclusive governance', 'public sector reform', 'local governance', 'institutional capacity', 'systems strengthening'] },
    { id: 'mel', label: 'Monitoring, evaluation & learning', synonyms: ['monitoring and evaluation', 'm and e', 'mel', 'meal', 'evaluation', 'results based management', 'results framework', 'logframe', 'logical framework', 'theory of change', 'indicators', 'baseline', 'impact assessment', 'learning agenda', 'evaluation design'] },
    { id: 'pm', label: 'Programme & project management', synonyms: ['project management', 'programme management', 'program management', 'portfolio oversight', 'portfolio management', 'project cycle', 'work plan', 'workplan', 'budget management', 'implementation', 'project delivery', 'grant management', 'procurement', 'project coordination', 'pmp', 'prince2'] },
    { id: 'capacity', label: 'Capacity building & facilitation', synonyms: ['capacity building', 'capacity development', 'training', 'facilitation', 'facilitator', 'curriculum', 'workshop', 'coaching', 'mentoring', 'mentorship', 'learning and development', 'training of trainers', 'tot'] },
    { id: 'humanitarian', label: 'Humanitarian response & programming', synonyms: ['humanitarian', 'emergency response', 'relief', 'cluster', 'sphere', 'protection', 'wash', 'food security', 'livelihoods', 'shock responsive', 'cash transfer', 'displacement', 'idp', 'humanitarian development peace nexus', 'nexus'] },
    { id: 'security', label: 'Security risk management', synonyms: ['security risk management', 'security management', 'safety and security', 'security risk', 'srmp', 'security plan', 'duty of care'] },
    { id: 'bcm', label: 'Business & public-service continuity', synonyms: ['business continuity', 'iso 22301', 'continuity planning', 'public service continuity', 'pscp', 'bcp', 'bcm', 'continuity of operations'] },
    { id: 'digital', label: 'Digital transformation & data', synonyms: ['digital transformation', 'data engineering', 'data analytics', 'data analysis', 'analytics', 'dashboard', 'dashboards', 'gis', 'information management', 'power bi', 'database', 'data management', 'platform', 'digital', 'automation', 'artificial intelligence', 'ai', 'machine learning', 'software', 'pwa', 'azure'] },
    { id: 'innovation', label: 'Innovation & systems thinking', synonyms: ['innovation', 'systems thinking', 'systems innovation', 'design thinking', 'entrepreneurship', 'startup', 'incubation', 'social innovation', 'innovation management', 'human centered design', 'u lab'] },
    { id: 'private_sector', label: 'Private sector, MSME & investment', synonyms: ['private sector', 'msme', 'msmes', 'sme', 'smes', 'value chain', 'enterprise development', 'ppp', 'public private partnership', 'investment promotion', 'investment', 'market systems', 'inclusive growth', 'financial inclusion', 'cooperatives', 'trade'] },
    { id: 'research', label: 'Research & publications', synonyms: ['research', 'publication', 'publications', 'academic', 'literature review', 'survey design', 'qualitative research', 'quantitative research', 'peer reviewed', 'research study', 'research studies', 'journal', 'journals'] },
    { id: 'stakeholder', label: 'Stakeholder & partnership engagement', synonyms: ['stakeholder engagement', 'stakeholder', 'stakeholders', 'multi stakeholder', 'consultation', 'consultations', 'coordination', 'coordinate with', 'coordinating with', 'liaise', 'liaison', 'development partners', 'partnership', 'partnerships', 'donor relations', 'convening', 'inter agency'] },
    { id: 'mhpss', label: 'Mental health & psychosocial support', synonyms: ['mental health', 'psychosocial', 'mhpss', 'psychological first aid', 'wellbeing', 'well being'] },
    { id: 'communications', label: 'Communications & knowledge management', synonyms: ['communications', 'branding', 'brand strategy', 'digital marketing', 'content', 'knowledge management', 'social media', 'visibility', 'writing', 'report writing'] },
    { id: 'unmapped', label: 'Requirements outside the competency taxonomy', synonyms: [] },
    { id: 'leadership', label: 'Team & organizational leadership', synonyms: ['lead a team', 'team leader', 'team lead', 'supervise', 'supervision', 'line management', 'manage a team', 'people management', 'leadership', 'direct reports', 'oversee staff', 'chief of party'] }
  ];
  const TAX_BY_ID = Object.fromEntries(TAXONOMY.map((t) => [t.id, t]));

  /* Explicit mapping of canonical disciplines -> competencies. New
     disciplines fall back to synonym detection on name + keywords. */
  const DISCIPLINE_MAP = {
    'climate-change-adaptation': ['cca', 'climate_finance'],
    'disaster-risk-reduction': ['drr', 'bcm'],
    'systems-innovation': ['innovation', 'digital'],
    'organizational-development': ['governance'],
    'strategic-thinking-planning': ['strategy'],
    'capacity-building': ['capacity'],
    'security-risk-management': ['security'],
    'private-sector-msme-development': ['private_sector'],
    'digital-transformation-data-engineering': ['digital'],
    'innovation-entrepreneurship': ['innovation'],
    'digital-growth-brand-strategy': ['communications']
  };

  /* Career pathways (Domain 2 — positioning). */
  const PATHWAYS = [
    { id: 'strategic_advisory', label: 'Strategic advisory', positioning: 'Senior strategy and policy adviser', competencies: ['strategy', 'policy', 'stakeholder', 'governance'], cv: 'Alvin_Silva_Strategic-Thinking-Planning_CV.pdf' },
    { id: 'humanitarian', label: 'Humanitarian leadership', positioning: 'Humanitarian programme and response management', competencies: ['humanitarian', 'security', 'mhpss', 'pm'], cv: 'Alvin_Silva_Development-Management_CV.pdf' },
    { id: 'resilience_climate', label: 'Resilience and climate', positioning: 'DRR, CCA and resilience specialist', competencies: ['drr', 'cca', 'climate_finance', 'bcm'], cv: 'Alvin_Silva_CCA-DRR_CV.pdf' },
    { id: 'institutional', label: 'Institutional transformation', positioning: 'Governance and organizational development', competencies: ['governance', 'capacity', 'mel', 'leadership'], cv: 'Alvin_Silva_Development-Management_CV.pdf' },
    { id: 'systems_innovation', label: 'Systems innovation', positioning: 'Digital and systems architecture practitioner', competencies: ['digital', 'innovation', 'communications'], cv: 'Alvin_Silva_Development-Management_CV.pdf' },
    { id: 'development_finance', label: 'Development finance', positioning: 'Investment roadmapping and programme development', competencies: ['private_sector', 'climate_finance', 'strategy'], cv: 'Alvin_Silva_PPP_CV.pdf' }
  ];

  /* Development responses for competency gaps (Domain 4). Generic on
     purpose: a course is only recommended when evidence is truly absent. */
  const DEV_ACTIONS = {
    bcm: 'Document ISO 22301 / PSCP-aligned work (e.g., continuity SOPs) and consider a recognized business-continuity credential.',
    climate_finance: 'Document climate-finance, project-financing or investment-appraisal work; consider structured climate-finance training.',
    mel: 'Document results frameworks, indicators and evaluations you designed or led; consider formal M&E training if none exist.',
    digital: 'Document platform, data and analytics delivery (architecture, users, outcomes) in project records.',
    leadership: 'Document team size, budget and decision authority for engagements you led.',
    humanitarian: 'Document emergency-response roles (context, cluster, scale) in project records.',
    security: 'Renew or replace expired security-risk credentials and document security-plan work.',
    research: 'Link publications and research outputs to the competencies they demonstrate.',
    policy: 'Document policy products (briefs, reviews, legislation support) and their adoption.',
    pm: 'Document budgets, timelines and delivery results for projects you managed.',
    mhpss: 'Document MHPSS module design and delivery scope.',
    default: 'Identify a project that demonstrates this competency and record the role, deliverables and results; if none exists, plan a targeted learning intervention.'
  };

  /* -------------------------------------------------------------- helpers */
  const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  /* Normalize to space-separated lowercase tokens, padded, for phrase match. */
  const norm = (v) => ' ' + String(v == null ? '' : v).toLowerCase()
    .replace(/&/g, ' and ').replace(/[‘’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const has = (normText, phrase) => normText.indexOf(' ' + phrase.trim() + ' ') !== -1;
  const unique = (xs) => [...new Set(xs.filter(Boolean))];
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
  const round = (n) => Math.round(n);
  const slug = (s) => String(s || '').toLowerCase().replace(/[–—]/g, '-')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /** FNV-1a 32-bit — stable, dependency-free input fingerprint. */
  function hash(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }

  function detectCompetencies(text) {
    const t = norm(text);
    const out = [];
    for (const c of TAXONOMY) {
      const hits = c.synonyms.filter((s) => has(t, s));
      if (hits.length) out.push({ id: c.id, hits });
    }
    return out;
  }

  /* ---------------------------------------------------------------- dates */
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  const monthOf = (tok) => {
    const t = String(tok || '').toLowerCase();
    if (t.length > 3 && !/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(t)) return null;
    return MONTHS[t.slice(0, 4)] ?? MONTHS[t.slice(0, 3)] ?? null;
  };
  const iso = (y, m, d) => {
    const dt = new Date(Date.UTC(y, m, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  };

  /**
   * Parse one date expression. Numeric dates with both parts ≤ 12 are
   * ambiguous; Philippine postings use MM/DD, so that is the default, but the
   * result is flagged for the user to confirm instead of silently trusted.
   */
  function parseDate(raw, today) {
    const s = clean(raw).replace(/(\d)(st|nd|rd|th)\b/gi, '$1').replace(/,/g, ' ');
    const now = today || new Date();
    let m;
    if ((m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) {
      const v = iso(+m[1], +m[2] - 1, +m[3]);
      if (v) return { iso: v, raw, confidence: 'high', ambiguous: false };
    }
    if ((m = s.match(/\b(\d{1,2})\s+([a-z]{3,9})\.?\s+(\d{4})\b/i)) && monthOf(m[2]) != null) {
      const v = iso(+m[3], monthOf(m[2]), +m[1]);
      if (v) return { iso: v, raw, confidence: 'high', ambiguous: false };
    }
    if ((m = s.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})\s+(\d{4})\b/i)) && monthOf(m[1]) != null) {
      const v = iso(+m[3], monthOf(m[1]), +m[2]);
      if (v) return { iso: v, raw, confidence: 'high', ambiguous: false };
    }
    if ((m = s.match(/\b(\d{1,2})[-\s]([a-z]{3})[a-z]*[-\s](\d{2,4})\b/i))) {
      const mon = MONTHS[m[2].toLowerCase()];
      let y = +m[3]; if (y < 100) y += 2000;
      if (mon != null) { const v = iso(y, mon, +m[1]); if (v) return { iso: v, raw, confidence: 'high', ambiguous: false }; }
    }
    if ((m = s.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/))) {
      let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
      if (a > 12 && b <= 12) { const v = iso(y, b - 1, a); if (v) return { iso: v, raw, confidence: 'medium', ambiguous: false, note: 'Read as DD/MM/YYYY.' }; }
      if (b > 12 && a <= 12) { const v = iso(y, a - 1, b); if (v) return { iso: v, raw, confidence: 'medium', ambiguous: false, note: 'Read as MM/DD/YYYY.' }; }
      const v = iso(y, a - 1, b);
      if (v) return { iso: v, raw, confidence: 'low', ambiguous: a !== b, note: a !== b ? 'Ambiguous numeric date — read as MM/DD/YYYY (Philippine convention). Confirm against the posting.' : undefined };
    }
    /* Month and day without a year: next occurrence, low confidence. */
    if ((m = s.match(/\b(\d{1,2})\s+([a-z]{3,9})\b/i) || s.match(/\b([a-z]{3,9})\s+(\d{1,2})\b/i))) {
      const first = m[1], second = m[2];
      const monTok = /\d/.test(first) ? second : first, dayTok = /\d/.test(first) ? first : second;
      const mon = monthOf(monTok);
      if (mon != null) {
        let y = now.getUTCFullYear();
        let v = iso(y, mon, +dayTok);
        if (v && v < now.toISOString().slice(0, 10)) v = iso(y + 1, mon, +dayTok);
        if (v) return { iso: v, raw, confidence: 'low', ambiguous: false, note: 'No year stated — assumed the next occurrence.' };
      }
    }
    return { iso: '', raw: clean(raw), confidence: 'low', ambiguous: false, note: 'Date could not be parsed.' };
  }

  const DEADLINE_RE = /(?:deadline(?:\s+(?:for|of)\s+(?:applications?|submission))?|closing date|closes? on|apply (?:by|before|no later than)|submit (?:by|before|no later than)|applications? (?:close|must be received by|will be accepted until)|until|on or before|not later than)\s*[:\-–]?\s*([^\n;]{4,48})/i;

  function findDeadline(text, today) {
    const m = text.match(DEADLINE_RE);
    if (!m) return { value: null, confidence: 'missing', source: '' };
    const d = parseDate(m[1], today);
    if (!d.iso) return { value: null, confidence: 'low', source: clean(m[0]), note: d.note };
    return { value: d.iso, raw: clean(m[1]), confidence: d.confidence, ambiguous: d.ambiguous, note: d.note, source: clean(m[0]) };
  }

  /* --------------------------------------------------------------- numbers */
  const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
  function yearsIn(statement) {
    const s = statement.toLowerCase();
    let m = s.match(/(\d{1,2})\s*\+?\s*(?:\(\s*\d+\s*\)\s*)?(?:or more\s+)?(?:years?|yrs?)/);
    if (!m) m = s.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s*(?:\(\s*\d+\s*\)\s*)?\+?\s*(?:or more\s+)?years?/);
    if (!m) return 0;
    const n = /\d/.test(m[1]) ? +m[1] : WORDNUM[m[1]];
    return n > 0 && n < 45 ? n : 0;
  }

  /* -------------------------------------------------------------- sections */
  const SECTION_RULES = [
    ['apply', /^(how to apply|application (process|procedure|requirements|instructions)|submission( requirements)?|documents? (to submit|required)|to apply|interested (applicants|candidates))\b/i],
    ['preferred', /^(desirable|preferred|assets?|advantage|nice to have|added advantage|additional (qualifications|skills)|preferred qualifications)\b/i],
    ['required', /^(qualifications?|requirements?|minimum (qualifications|requirements)|essential( criteria| qualifications)?|required( qualifications| skills| experience)?|must have|eligibility|education( and experience)?|experience|what you (bring|need)|qualification standards|selection criteria|profile)\b/i],
    ['responsibilities', /^(responsibilities|key responsibilities|duties|duties and responsibilities|key tasks|tasks|scope of (work|services)|deliverables|expected outputs|outputs|what you will do|the role|job (description|purpose|summary)|objectives?|accountabilities|functions)\b/i],
    ['competencies', /^(competenc(y|ies)|core competencies|skills( and competencies)?|technical competencies|behavioural competencies|behavioral competencies|core values)\b/i],
    ['conditions', /^(terms( and conditions)?|conditions|contract( details| type)?|remuneration|salary|compensation|benefits|duty station|duration|period of (performance|engagement))\b/i],
    ['about', /^(about (us|the (organization|organisation|company|agency|project|programme|program))|who we are|background|context|organizational setting|organisational setting|introduction)\b/i]
  ];

  function headingKind(line) {
    const l = line.replace(/^[#*\s\d.)-]+/, '').replace(/[:\s]+$/, '').trim();
    if (!l || l.length > 70) return null;
    for (const [kind, re] of SECTION_RULES) if (re.test(l)) return kind;
    return null;
  }

  function segment(text) {
    const lines = String(text).split(/\r?\n/).map((l) => l.trim());
    const sections = [];
    let cur = { kind: 'none', heading: '', lines: [] };
    for (const raw of lines) {
      if (!raw) continue;
      const kind = headingKind(raw);
      /* "Qualifications: Master's degree…" — heading with inline content */
      const inline = raw.match(/^([A-Za-z][A-Za-z ()/&-]{2,50}):\s*(.{6,})$/);
      if (kind && (!inline || headingKind(inline[1]) === kind) && (raw.length <= 70 || inline)) {
        sections.push(cur);
        cur = { kind, heading: raw.replace(/[:\s]+$/, ''), lines: [] };
        if (inline && headingKind(inline[1])) cur.lines.push(inline[2]);
        continue;
      }
      cur.lines.push(raw);
    }
    sections.push(cur);
    return sections.filter((s) => s.lines.length || s.heading);
  }

  function splitStatements(line) {
    /* Strip bullet glyphs and list numbering ("1.", "2)", "(a)") but never a
       leading quantity such as "7+ years". */
    const stripped = line.replace(/^(?:[\u2022\u25CF\u25AA\u2013\u2014*\u00B7>-]+\s*|\(?\d{1,2}[.)]\s+|\(?[a-z][.)]\s+)/i, '').trim();
    if (stripped.length < 220) return stripped ? [stripped] : [];
    return stripped.split(/(?<=[.;])\s+(?=[A-Z(])/).map((x) => x.trim()).filter((x) => x.length > 3);
  }

  /* --------------------------------------------------------- classification */
  const MANDATORY_RE = /\b(must|required|requirement|mandatory|essential|minimum|at least|necessary|indispensable|shall have)\b/i;
  const PREFERRED_RE = /\b(preferred|preferably|desirable|desired|an advantage|advantageous|asset|ideally|nice to have|added advantage|is a plus|would be an advantage|beneficial)\b/i;
  const TYPE_RULES = [
    ['eligibility', /\b(citizen|citizenship|nationality|national of|nationals|work permit|authori[sz]ation to work|right to work|eligible to work|residen(t|cy)|security clearance|driver s licen[cs]e|driving licen[cs]e|civil service eligibility|cs eligibility|career service|ra 1080|age limit|years old)\b/i],
    ['education', /\b(degree|bachelor|bachelors|masters?|master s|phd|ph d|doctorate|doctoral|diploma|graduate of|graduate degree|post ?graduate|mba|mpa|mph|mdm|university education|academic qualification)\b/i],
    ['certification', /\b(certif\w*|licen[cs]ed|licen[cs]e|pmp|prince2|chartered|accredit\w*|registered professional|cbci|cissp|cpa|cfa)\b/i],
    ['language', /\b(english|filipino|tagalog|french|arabic|spanish|bahasa|cebuano|maranao|maguindanaon|tausug|language|fluency|fluent|proficiency in (english|filipino))\b/i],
    ['experience', /\b(\d{1,2}\s*\+?\s*(\(\s*\d+\s*\)\s*)?years?|(one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen)\s*(\(\s*\d+\s*\)\s*)?years?|experience (in|with|of|working)|proven experience|track record|demonstrated experience)\b/i]
  ];
  const DOCS = [
    { id: 'cv', label: 'CV / résumé', re: /\b(cv|curriculum vitae|resume|résumé)\b/i, effort: 0.5, ready: 'ready' },
    { id: 'cover_letter', label: 'Cover letter / letter of interest', re: /\b(cover letter|letter of (intent|interest|motivation)|motivation letter|application letter)\b/i, effort: 0.5, ready: 'generated' },
    { id: 'pds', label: 'Personal Data Sheet (CS Form 212)', re: /\b(personal data sheet|pds|cs form (no )?212)\b/i, effort: 0.5, ready: 'available', link: 'pds.html' },
    { id: 'p11', label: 'P11 / Personal History Form', re: /\b(p11|personal history form|phf)\b/i, effort: 1, ready: 'prepare' },
    { id: 'writing_sample', label: 'Writing sample', re: /\b(writing sample|sample of (written )?work|publication sample)\b/i, effort: 0.5, ready: 'available' },
    { id: 'references', label: 'References / referees', re: /\b(references|referees|reference letters?)\b/i, effort: 1, ready: 'prepare' },
    { id: 'technical_proposal', label: 'Technical proposal / methodology', re: /\b(technical proposal|methodology|work ?plan and approach|technical offer|proposed approach)\b/i, effort: 3, ready: 'prepare' },
    { id: 'financial_proposal', label: 'Financial proposal', re: /\b(financial proposal|financial offer|price proposal|daily fee|professional fee proposal)\b/i, effort: 1, ready: 'prepare' },
    { id: 'transcript', label: 'Transcript / diploma copies', re: /\b(transcript of records|tor|transcripts?|diploma|copy of (the )?degree)\b/i, effort: 1, ready: 'verify' },
    { id: 'eligibility_cert', label: 'Certificate of eligibility / rating', re: /\b(certificate of eligibility|report of rating|csc eligibility)\b/i, effort: 1, ready: 'verify' },
    { id: 'portfolio', label: 'Portfolio / work samples', re: /\b(portfolio|work samples)\b/i, effort: 0.5, ready: 'available', link: 'portfolio.html' }
  ];

  const GENERIC_EXP = new Set(['experience', 'experiences', 'professional', 'relevant', 'progressive', 'progressively', 'responsible', 'work', 'working', 'related', 'proven', 'demonstrated', 'overall', 'total', 'years', 'year', 'least', 'minimum', 'with', 'and', 'the', 'of', 'in', 'must', 'have', 'has', 'required', 'requirement', 'mandatory', 'essential', 'more', 'than', 'plus', 'solid', 'strong', 'extensive', 'previous', 'prior', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'twelve', 'fifteen', 'yrs', 'post', 'level', 'senior', 'similar', 'role', 'roles', 'position', 'positions', 'field', 'area', 'areas', 'least', 'deep', 'good', 'excellent', 'hands', 'experienced', 'track', 'record']);
  const HEADER_FIELD_RE = /^(position( title)?|job title|title|vacancy|post|role|organi[sz]ation|employer|company|agency|institution|office|client|duty station|location|work location|place of (assignment|work)|contract( type)?|type of contract|employment type|grade|level|salary grade|reference( no| number)?|vacancy (no|number)|closing date|deadline|posting date|date posted)\s*[:\-–]/i;

  function classify(statement, sectionKind) {
    if (/^(apply|submit|send|e-?mail|interested (applicants|candidates)|applications? (should|must|may))\b/i.test(statement) || DEADLINE_RE.test(statement) && statement.length < 90) return { type: 'document', priority: 'document' };
    if (sectionKind === 'conditions' && !TYPE_RULES[0][1].test(statement)) return { type: 'condition', priority: 'condition' };
    let type = 'competency';
    for (const [t, re] of TYPE_RULES) { if (re.test(statement)) { type = t; break; } }
    if (type === 'competency' && (sectionKind === 'responsibilities')) type = 'responsibility';
    let priority;
    if (PREFERRED_RE.test(statement)) priority = 'preferred';
    else if (MANDATORY_RE.test(statement)) priority = 'mandatory';
    else priority = ({ required: 'mandatory', preferred: 'preferred', responsibilities: 'responsibility', competencies: 'competency', apply: 'document', conditions: 'condition', about: 'context' })[sectionKind] || 'unspecified';
    return { type, priority };
  }

  const DEGREE_LEVEL = [[3, /\b(phd|ph d|doctorate|doctoral)\b/i], [2, /\b(master|masters|master s|mba|mpa|mph|mdm|postgraduate|post graduate|graduate degree|advanced degree|msc|ma)\b/i], [1, /\b(bachelor|bachelors|bachelor s|college degree|undergraduate|bs|ba|university degree)\b/i]];
  function degreeLevels(s) {
    const n = norm(s);
    return DEGREE_LEVEL.filter(([, re]) => re.test(n)).map(([lvl]) => lvl);
  }
  function degreeFields(s) {
    const m = s.match(/\bdegree\s+(?:in|on)\s+([^.;]+)/i) || s.match(/\b(?:master'?s?|bachelor'?s?|phd|doctorate)\s+(?:degree\s+)?(?:in|of)\s+([^.;]+)/i);
    if (!m) return [];
    return m[1].split(/,|\bor\b|\/|\band\b/i).map((x) => clean(x).replace(/^(a|an|the)\s+/i, '').replace(/\b(or )?(a )?(closely )?related (field|discipline)s?\b.*$/i, '').trim()).filter((x) => x.length > 2);
  }

  /* ------------------------------------------------------------ extraction */
  const ROLE_NOUN = /\b(adviser|advisor|consultant|specialist|manager|director|officer|coordinator|analyst|lead|head|chief|expert|associate|fellow|researcher|team leader|planner|architect|engineer|developer|evaluator|facilitator|trainer|programme|program|nurse|physician|teacher|instructor|accountant|assistant|secretary|clerk|technician|designer|writer|editor|scientist|economist|lawyer|attorney|driver|representative)\b/i;
  const SENIORITY = [
    [5, /\b(director|head of|chief|executive|country representative|deputy director|vice president|undersecretary|assistant secretary)\b/i],
    [4, /\b(senior|sr\.?|lead|principal|team leader|chief of party|p ?5|p ?4|d ?1|salary grade (2[4-9]|3\d))\b/i],
    [3, /\b(specialist|manager|consultant|adviser|advisor|expert|p ?3|planning officer (iv|v)|salary grade (1[8-9]|2[0-3]))\b/i],
    [2, /\b(officer|analyst|coordinator|associate|p ?2|researcher)\b/i],
    [1, /\b(assistant|intern|trainee|junior|entry level|aide)\b/i]
  ];
  const SECTORS = {
    government: ['government', 'ministry', 'department of', 'agency', 'bureau', 'public sector', 'local government', 'lgu', 'city government', 'provincial government', 'municipal', 'barmm', 'bangsamoro government', 'civil service', 'plantilla', 'salary grade'],
    humanitarian: ['humanitarian', 'relief', 'emergency response', 'ngo', 'ingo', 'non government', 'nonprofit', 'non profit', 'civil society', 'united nations', 'un agency', 'undp', 'unicef', 'unhcr', 'wfp', 'who', 'iom', 'unfpa', 'ocha', 'red cross', 'save the children', 'world vision', 'oxfam', 'care international', 'plan international', 'action against hunger', 'development partner', 'donor'],
    private: ['private sector', 'corporate', 'company', 'enterprise', 'consulting firm', 'startup', 'inc', 'corporation', 'firm'],
    academic: ['university', 'college', 'academic', 'research institute', 'professor', 'lecturer', 'faculty', 'fellowship', 'postdoctoral']
  };
  const MULTILATERAL = /\b(united nations|undp|unicef|unhcr|wfp|who|iom|unfpa|ocha|undrr|ilo|fao|world bank|asian development bank|adb|giz|usaid|dfat|jica|koica|echo|european union|eu delegation|ifrc|icrc)\b/i;
  const PH_PLACES = ['philippines', 'manila', 'metro manila', 'quezon city', 'makati', 'pasig', 'taguig', 'mandaluyong', 'cebu', 'davao', 'baguio', 'iloilo', 'bacolod', 'zamboanga', 'cotabato', 'cotabato city', 'marawi', 'ormoc', 'tacloban', 'leyte', 'samar', 'eastern samar', 'camarines sur', 'bicol', 'visayas', 'mindanao', 'luzon', 'barmm', 'bangsamoro', 'calabarzon', 'cavite', 'eastern visayas', 'caraga', 'general santos'];
  const WORLD_PLACES = ['geneva', 'new york', 'nairobi', 'rome', 'vienna', 'london', 'paris', 'washington', 'brussels', 'bonn', 'copenhagen', 'tokyo', 'seoul', 'dubai', 'amman', 'beirut', 'addis ababa', 'dakar', 'panama', 'sydney', 'canberra', 'wellington', 'kabul', 'yangon', 'dhaka', 'cox s bazar', 'kathmandu', 'islamabad', 'colombo', 'hanoi', 'phnom penh', 'dili'];
  const ASIA_PAC = ['asia', 'pacific', 'southeast asia', 'south asia', 'asean', 'bangkok', 'jakarta', 'indonesia', 'thailand', 'viet nam', 'vietnam', 'myanmar', 'cambodia', 'timor', 'bangladesh', 'nepal', 'pakistan', 'sri lanka', 'fiji', 'papua', 'kuala lumpur', 'malaysia', 'singapore'];

  function field(value, confidence, source, extra) {
    return Object.assign({ value: value == null || value === '' ? null : value, confidence: value == null || value === '' ? 'missing' : confidence, source: clean(source).slice(0, 160) }, extra || {});
  }
  function labelled(text, labels) {
    const re = new RegExp('^\\s*(?:' + labels + ')\\s*[:\\-–]\\s*(.{2,140})$', 'im');
    const m = text.match(re);
    return m ? { value: clean(m[1]), source: m[0] } : null;
  }

  function extractJob(text, opts) {
    const options = opts || {};
    const today = options.today || new Date();
    const raw = String(text || '');
    const lines = raw.split(/\r?\n/).map(clean).filter(Boolean);
    const n = norm(raw);

    /* title */
    const title = labelled(raw, 'position title|job title|title|vacancy title|post title|assignment title|consultancy title|position applied for');
    const genericTitle = labelled(raw, 'position|role|post|vacancy');
    const firstRole = lines.slice(0, 6).find((l) => l.length <= 100 && ROLE_NOUN.test(l) && !/[.!?]$/.test(l) && !HEADER_FIELD_RE.test(l));
    let titleField;
    if (title) titleField = field(title.value, 'high', title.source);
    else if (firstRole) titleField = field(firstRole, 'medium', firstRole);
    else if (genericTitle) titleField = field(genericTitle.value, 'medium', genericTitle.source);
    else {
      const m = raw.match(/\b(?:seeking|recruiting|hiring|looking for)\s+(?:an?|the)?\s*([A-Z][^\n.,;]{3,80})/);
      titleField = field(m ? clean(m[1]) : null, 'low', m ? m[0] : '');
    }

    /* organization */
    let org = labelled(raw, 'organi[sz]ation|employer|company|agency|institution|hiring (?:organi[sz]ation|office|agency)|office|client|procuring entity');
    let orgField;
    if (org) orgField = field(org.value, 'high', org.source);
    else {
      const known = (options.institutions || []).concat(['UNDP', 'UNICEF', 'UNHCR', 'WFP', 'IOM', 'UNFPA', 'OCHA', 'UNDRR', 'ILO', 'FAO', 'World Bank', 'Asian Development Bank', 'GIZ', 'USAID', 'JICA', 'Save the Children', 'World Vision', 'Oxfam', 'Plan International', 'Action Against Hunger', 'Philippine Red Cross', 'IFRC'])
        .filter((x) => x && x.length > 2)
        .map((x) => ({ x, i: raw.toLowerCase().indexOf(x.toLowerCase()) }))
        .filter((o) => o.i !== -1).sort((a, b) => a.i - b.i);
      const intro = lines.slice(0, 8).join(' ').match(/^(?:the\s+)?([A-Z][A-Za-z0-9&.,'() -]{2,80}?)\s+(?:is|seeks|invites|is seeking|is looking)\b/m);
      if (intro && intro[1].split(' ').length <= 10) orgField = field(clean(intro[1]), 'medium', intro[0]);
      else if (known.length) orgField = field(known[0].x, 'medium', known[0].x);
      else {
        const m = raw.match(/\b(?:at|with|join)\s+(?:the\s+)?([A-Z][A-Za-z0-9&.' -]{2,60})/);
        orgField = field(m ? clean(m[1]) : null, 'low', m ? m[0] : '');
      }
    }

    /* location */
    let loc = labelled(raw, 'duty station|location|work location|place of (?:assignment|work)|based in|work site|station');
    let locField;
    if (loc) locField = field(loc.value, 'high', loc.source);
    else {
      const ph = PH_PLACES.find((p) => has(n, p)) || ASIA_PAC.concat(WORLD_PLACES).find((p) => has(n, p));
      locField = field(ph ? ph.replace(/\b\w/g, (c) => c.toUpperCase()) : null, 'medium', ph || '');
    }
    const remote = /\b(remote|home[- ]based|work from home|wfh|telecommut\w*|hybrid)\b/i.exec(raw);

    /* employment type */
    let employment = null;
    if (/\b(individual consultant|consultan(cy|t)|individual contractor|ic contract|consulting services|expert services|short[- ]term)\b/i.test(raw)) employment = 'consultancy';
    else if (/\b(fixed[- ]term|temporary|contract of service|job order|contractual|project[- ]based|cos)\b/i.test(raw)) employment = 'contract';
    else if (/\b(permanent|regular|plantilla|full[- ]time|indefinite)\b/i.test(raw)) employment = 'permanent';
    const durationM = raw.match(/\b(?:duration|period|for a period of|contract (?:length|duration))\D{0,20}(\d{1,3})\s*(months?|weeks?|working days|days)/i);

    /* seniority */
    const titleText = (titleField.value || '') + ' ' + lines.slice(0, 3).join(' ');
    let seniority = null;
    for (const [lvl, re] of SENIORITY) { if (re.test(titleText)) { seniority = lvl; break; } }

    /* compensation */
    const comp = raw.match(/(?:(?:PHP|Php|₱|USD|US\$|\$|EUR|€)\s?[\d,]{3,}(?:\.\d+)?(?:\s?(?:k|m|million))?(?:\s*(?:-|–|to)\s*(?:PHP|₱|USD|\$|EUR|€)?\s?[\d,]{3,}(?:\.\d+)?)?(?:\s*(?:per|\/)\s*(?:month|year|annum|day|hour))?|salary grade\s*\d{1,2}|\bSG\s?-?\d{1,2}\b|\b[PD]-?\d\b(?= level| post|\b))/i);

    /* sector */
    const sectorScores = Object.entries(SECTORS).map(([s, terms]) => ({ s, score: terms.filter((t) => has(n, t)).length }))
      .sort((a, b) => b.score - a.score);
    const sector = sectorScores[0].score ? sectorScores[0].s : null;

    /* requirement statements */
    const sections = segment(raw);
    const requirements = [];
    let idx = 0;
    for (const sec of sections) {
      for (const line of sec.lines) {
        for (const st of splitStatements(line)) {
          if (st.length < 8 || st.length > 600) continue;
          if (HEADER_FIELD_RE.test(st)) continue;   /* consumed as a field, not a requirement */
          const { type, priority } = classify(st, sec.kind);
          if (priority === 'context') continue;
          const comps = detectCompetencies(st).map((c) => c.id);
          const r = { id: 'r' + (++idx), text: st, section: sec.kind, priority, type, competencies: comps };
          if (type === 'experience') {
            r.years = yearsIn(st);
            const content = norm(st).trim().split(' ').filter((w) => w.length > 2 && !GENERIC_EXP.has(w) && !/^\d+$/.test(w));
            if (!comps.length && content.length) r.unmapped = true;
          }
          if (type === 'education') { r.degreeLevels = degreeLevels(st); r.fields = degreeFields(st); r.relatedOk = /related (field|discipline)|equivalent|relevant (field|discipline)/i.test(st); }
          if (type === 'certification') r.certs = (st.match(/\b(PMP|PRINCE2|CBCI|MBCI|CISSP|CPA|CFA|ISO\s?\d{4,5}|SRMP(?:-C)?|[A-Z]{3,6}(?=\s*(?:certif|credential)))\b/g) || []).map(clean);
          if (type === 'language') r.languages = unique((st.match(/\b(English|Filipino|Tagalog|French|Arabic|Spanish|Bahasa|Cebuano|Maranao|Maguindanaon|Tausug)\b/gi) || []).map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()));
          requirements.push(r);
        }
      }
    }
    const hasRequiredSection = sections.some((s) => s.kind === 'required');

    /* required years */
    const expMandatory = requirements.filter((r) => r.type === 'experience' && r.years && r.priority === 'mandatory');
    const expAny = requirements.filter((r) => r.type === 'experience' && r.years);
    const yrsPool = expMandatory.length ? expMandatory : expAny;
    const requiredYears = yrsPool.length ? Math.max(...yrsPool.map((r) => r.years)) : 0;
    const yrsSrc = yrsPool.find((r) => r.years === requiredYears);

    /* degree */
    const eduMandatory = requirements.filter((r) => r.type === 'education' && r.priority !== 'preferred' && r.degreeLevels && r.degreeLevels.length);
    const degreeLevel = eduMandatory.length ? Math.min(...eduMandatory.map((r) => Math.min(...r.degreeLevels))) : 0;

    /* documents */
    const applyText = sections.filter((s) => s.kind === 'apply').map((s) => s.lines.join('\n')).join('\n') || raw;
    const documents = DOCS.filter((d) => d.re.test(applyText) || (d.id !== 'transcript' && d.id !== 'references' && d.re.test(raw)))
      .map((d) => ({ id: d.id, label: d.label, effort: d.effort, readiness: d.ready, link: d.link || null }));
    if (!documents.some((d) => d.id === 'cv')) documents.unshift({ id: 'cv', label: 'CV / résumé', effort: 0.5, readiness: 'ready', link: null, assumed: true });

    /* competency weights */
    const PRIORITY_W = { mandatory: 3, responsibility: 2, competency: 1.5, unspecified: 1.5, preferred: 1, document: 0, condition: 0.5 };
    const compWeights = {};
    const addW = (id, w) => { compWeights[id] = (compWeights[id] || 0) + w; };
    const NON_COMPETENCY = new Set(['education', 'language', 'eligibility']);
    requirements.forEach((r) => {
      if (NON_COMPETENCY.has(r.type)) return;
      if (r.competencies.length) r.competencies.forEach((c) => addW(c, PRIORITY_W[r.priority] ?? 1));
      /* Demand the taxonomy cannot map (e.g. "Java", "ICU nursing") is kept
         as explicit unmet weight. Dropping it inflated scores for roles far
         outside the profile — the negative-control test guards this. */
      else if (['mandatory', 'responsibility', 'competency'].includes(r.priority) && (r.type === 'responsibility' || r.type === 'experience' || r.type === 'competency' || r.type === 'certification')) {
        r.unmapped = true;
        addW('unmapped', (PRIORITY_W[r.priority] ?? 1) * 0.8);
      }
    });
    detectCompetencies(titleField.value || '').forEach((c) => addW(c.id, 3));
    if (seniority >= 4 && !compWeights.leadership) addW('leadership', 2);

    const fields = {
      title: titleField,
      organization: orgField,
      location: locField,
      remote: field(remote ? remote[1].toLowerCase() : null, 'medium', remote ? remote[0] : ''),
      employmentType: field(employment, 'medium', employment || ''),
      duration: field(durationM ? `${durationM[1]} ${durationM[2]}` : null, 'medium', durationM ? durationM[0] : ''),
      seniority: field(seniority, titleField.confidence === 'high' ? 'high' : 'medium', titleText.slice(0, 80)),
      sector: field(sector, sectorScores[0].score >= 2 ? 'medium' : 'low', sector || ''),
      deadline: findDeadline(raw, today),
      requiredYears: field(requiredYears || null, expMandatory.length ? 'high' : 'medium', yrsSrc ? yrsSrc.text : ''),
      degreeLevel: field(degreeLevel || null, eduMandatory.length ? 'high' : 'low', eduMandatory[0] ? eduMandatory[0].text : ''),
      compensation: field(comp ? clean(comp[0]) : null, 'medium', comp ? comp[0] : '')
    };

    return {
      fields, requirements, documents, competencyWeights: compWeights,
      structure: { sections: sections.map((s) => s.kind), hasRequiredSection, statements: requirements.length },
      text: raw, textHash: hash(norm(raw)), words: raw.split(/\s+/).filter(Boolean).length
    };
  }

  /** Apply user corrections to extracted fields (human validation step). */
  function applyEdits(job, edits) {
    if (!edits) return job;
    const out = JSON.parse(JSON.stringify(job));
    for (const [k, v] of Object.entries(edits)) {
      if (!out.fields[k]) continue;
      const val = v === '' ? null : (['requiredYears', 'seniority', 'degreeLevel'].includes(k) ? (v == null ? null : Number(v)) : v);
      out.fields[k] = Object.assign({}, out.fields[k], { value: val, confidence: val == null ? 'missing' : 'user', source: 'Edited by user' });
      if (k === 'deadline') { out.fields[k].ambiguous = false; out.fields[k].note = undefined; }
    }
    return out;
  }

  /* -------------------------------------------------------------- evidence */
  function disciplineCompetencies(d) {
    const mapped = DISCIPLINE_MAP[slug(d.name)];
    if (mapped) return mapped;
    return detectCompetencies([d.name].concat(d.keywords || []).join(' ; ')).map((c) => c.id);
  }

  /**
   * Turn credentials.json into evidence items with explicit evidence levels.
   * A project with only a name and keywords is "documented" for existence,
   * but its role is "not recorded" — letters must not claim leadership of it.
   */
  function buildEvidenceIndex(creds, opts) {
    const today = (opts && opts.today) || new Date();
    const items = [];
    const p = creds.profile || {};
    const notes = p._metric_notes || {};

    (creds.disciplines || []).forEach((d) => {
      items.push({ id: 'disc:' + slug(d.name), kind: 'discipline', title: d.name, level: 'self-reported',
        years: Number(d.years) || 0, competencies: disciplineCompetencies(d), detail: (d.keywords || []).slice(0, 8).join(', '), cv: d.cv || null });
    });
    (creds.projects || []).forEach((x) => {
      const txt = [x.name, x.client, x.description, (x.keywords || []).join(' ; ')].join(' ; ');
      const found = detectCompetencies(txt);
      const fromDesc = new Set(detectCompetencies([x.name, x.description].join(' ; ')).map((c) => c.id));
      const comps = found.map((c) => c.id);
      /* strong = stated in the name/description or ≥2 distinct keyword hits;
         weak = one keyword hit only, i.e. an inferred link */
      const links = Object.fromEntries(found.map((c) => [c.id, fromDesc.has(c.id) || c.hits.length >= 2 ? 'strong' : 'weak']));
      const role = x.role || (x.description && /^(consultant|lead|team leader|adviser|advisor|author|architect|designer|mentor|facilitator|served as)\b/i.test(x.description) ? x.description.split(/[:,.]/)[0] : null);
      items.push({ id: 'proj:' + slug(x.name), kind: 'project', title: x.name, level: 'documented', sector: x.sector || null,
        year: x.year || null, client: x.client || null, role: role || null, status: x.status || null,
        description: x.description || '', competencies: comps, links, keywords: x.keywords || [],
        completeness: (x.description ? 1 : 0) + (x.client ? 1 : 0) + (role ? 1 : 0) + (x.year ? 1 : 0) });
    });
    (creds.certifications || []).forEach((c) => {
      let status = c.status;
      if (status !== 'expired' && c.expires && new Date(c.expires + 'T23:59:59') < today) status = 'expired';
      const DOMAIN = { digital: ['digital'], innovation: ['innovation'], private: ['private_sector'] };
      const comps = unique(detectCompetencies(c.name).map((x) => x.id).concat(DOMAIN[c.domain] || []));
      items.push({ id: 'cert:' + slug(c.name), kind: 'certification', title: c.name, issuer: c.issuer || '', issued: c.issued || null,
        expires: c.expires || null, status: status || 'unverified', note: c.note || null,
        level: (c.verify_url || c.credential_id || c.evidence) ? 'verified' : 'documented', competencies: comps, verifyUrl: c.verify_url || null });
    });
    (creds.memberships || []).forEach((m) => {
      items.push({ id: 'mem:' + slug(m.name + ' ' + m.organization), kind: 'membership', title: `${m.name}, ${m.organization}`,
        level: m.reference ? 'verified' : 'documented', status: m.status || null, reference: m.reference || null,
        competencies: detectCompetencies((m.recognized_fields || []).join(' ; ')).map((x) => x.id), detail: (m.recognized_fields || []).join(', ') });
    });
    (creds.appointments || []).forEach((a) => {
      items.push({ id: 'appt:' + slug(a.role + ' ' + a.program), kind: 'appointment', title: `${a.role} — ${a.program}`, client: a.organization,
        year: String(a.date || '').slice(0, 4) || null, level: a.signatories ? 'verified' : 'documented',
        competencies: unique(['capacity'].concat(detectCompetencies([a.role, a.program, a.focus || ''].join(' ; ')).map((x) => x.id))) });
    });
    const tt = creds.technical_training;
    if (tt && Array.isArray(tt.tracks)) {
      tt.tracks.forEach((t) => {
        items.push({ id: 'train:' + slug(t.track), kind: 'training', title: `${t.track} (${tt.provider || 'training'})`, year: String(t.completed || '').slice(0, 4) || null,
          level: tt.transcript_url ? 'verified' : 'documented', verifyUrl: tt.transcript_url || null,
          competencies: unique(['digital'].concat(detectCompetencies(t.track + ' ; ' + (t.modules || []).join(' ; ')).map((x) => x.id))) });
      });
    }
    (creds.publications || []).forEach((x) => {
      items.push({ id: 'pub:' + slug(x.title), kind: 'publication', title: x.title, year: x.year || null, level: 'documented', pubType: x.type,
        competencies: unique(['research'].concat(detectCompetencies(x.title + ' ' + (x.summary || '')).map((c) => c.id))) });
    });
    (p.degrees || []).forEach((d, i) => {
      items.push({ id: 'deg:' + i, kind: 'degree', title: d, level: 'documented', competencies: detectCompetencies(d).map((c) => c.id) });
    });

    /* per-competency strength: 1 − Π(1 − 0.55·w), discipline years scale w */
    const byCompetency = {};
    const strength = {};
    const best = {};
    for (const t of TAXONOMY) {
      const list = items.filter((it) => it.competencies.includes(t.id) && !(it.kind === 'certification' && it.status === 'expired'));
      byCompetency[t.id] = list.map((x) => x.id);
      let miss = 1, bestLvl = 'unknown';
      list.forEach((it) => {
        let w = LEVELS[it.level].w;
        if (it.kind === 'discipline') w *= Math.min(1, (it.years || 0) / 10);
        if (it.kind === 'publication' || it.kind === 'degree') w *= 0.6;
        const weak = it.kind === 'project' && it.links && it.links[t.id] === 'weak';
        if (it.kind === 'project' && it.completeness < 2) w *= 0.75;
        if (weak) w = LEVELS.inferred.w;
        miss *= 1 - 0.55 * w;
        const lvl = weak ? 'inferred' : it.level;
        if (LEVELS[lvl].w > LEVELS[bestLvl].w && it.kind !== 'discipline') bestLvl = lvl;
        else if (bestLvl === 'unknown' && it.kind === 'discipline') bestLvl = 'self-reported';
      });
      strength[t.id] = list.length ? 1 - miss : 0;
      best[t.id] = bestLvl;
    }
    const discYears = {};
    items.filter((i) => i.kind === 'discipline').forEach((d) => d.competencies.forEach((c) => { discYears[c] = Math.max(discYears[c] || 0, d.years); }));

    const years = Number(p.years_total) || 0;
    const projects = items.filter((i) => i.kind === 'project');
    const unverifiedMetrics = Object.entries(notes).filter(([, v]) => /unverified/i.test(String(v))).map(([k]) => k);
    return {
      items, byId: Object.fromEntries(items.map((i) => [i.id, i])), byCompetency, strength, bestLevel: best, disciplineYears: discYears,
      profileLevel: years >= 15 ? 4 : years >= 8 ? 3 : years >= 3 ? 2 : 1,
      profileDegreeLevel: Math.max(0, ...((p.degrees || []).map((d) => Math.max(0, ...degreeLevels(d))))),
      profileDegreeText: (p.degrees || []).join(' ; '),
      years,
      unverifiedMetrics,
      dataQuality: {
        projects: projects.length,
        withDescription: projects.filter((x) => x.description).length,
        withClient: projects.filter((x) => x.client).length,
        withRole: projects.filter((x) => x.role).length,
        withYear: projects.filter((x) => x.year).length,
        hasLanguages: Array.isArray(p.languages) && p.languages.length > 0,
        expiredCertifications: items.filter((i) => i.kind === 'certification' && i.status === 'expired').map((i) => i.title)
      }
    };
  }

  /* ------------------------------------------------------------ eligibility */
  const PROFILE_FIELDS = ['development management', 'development studies', 'development', 'management', 'social sciences', 'social science', 'political science'];
  const STATUS_SCORE = { met: 1, 'likely met': 0.85, 'needs verification': 0.55, 'manual check': 0.6, 'not evidenced': 0.1, expired: 0.15 };

  function checkRequirement(r, ev) {
    const out = { id: r.id, text: r.text, type: r.type, priority: r.priority, status: 'needs verification', evidence: [], note: '' };
    if (r.type === 'education') {
      const need = r.degreeLevels && r.degreeLevels.length ? Math.min(...r.degreeLevels) : 0;
      if (need && ev.profileDegreeLevel >= need) {
        const deg = ev.items.filter((i) => i.kind === 'degree');
        out.evidence = deg.map((d) => d.id);
        if (r.fields && r.fields.length) {
          const fieldHit = r.fields.some((f) => PROFILE_FIELDS.some((pf) => norm(f).includes(' ' + pf + ' ')));
          out.status = fieldHit ? 'met' : (r.relatedOk ? 'needs verification' : 'needs verification');
          out.note = fieldHit ? 'Degree level and field match the documented degrees.' : `Degree level met; field (${r.fields.join(', ')}) must be confirmed as equivalent to the documented degrees.`;
        } else { out.status = 'met'; out.note = 'Required degree level matches a documented degree.'; }
      } else if (need) {
        out.status = 'not evidenced';
        out.note = `Requires ${['', 'a bachelor', 'a master', 'a doctoral'][need]} degree; no documented degree at that level.`;
      } else { out.status = 'needs verification'; out.note = 'Education requirement detected but the degree level was not identified.'; }
    } else if (r.type === 'experience') {
      const relYears = Math.max(0, ...r.competencies.map((c) => ev.disciplineYears[c] || 0));
      const need = r.years || 0;
      if (!need) { out.status = r.competencies.some((c) => ev.strength[c] >= 0.5) ? 'likely met' : 'needs verification'; out.note = 'Experience requirement without a stated number of years.'; }
      else if (relYears >= need) { out.status = 'likely met'; out.note = `${relYears} years recorded in the most relevant discipline (self-reported) against ${need} required.`; }
      else if (!r.competencies.length && ev.years >= need && !r.unmapped) { out.status = 'likely met'; out.note = `${ev.years}+ years total experience against ${need} required (domain not specified).`; }
      else if (!r.competencies.length && r.unmapped) { out.status = 'not evidenced'; out.note = `Requires ${need} years in a domain that is not represented in the professional record.`; }
      else if (ev.years >= need) { out.status = 'needs verification'; out.note = relYears ? `${ev.years}+ years total, but only ${relYears} years recorded in this specific domain. Confirm relevant experience.` : `${ev.years}+ years total, but no years are recorded in this specific domain. Confirm relevant experience.`; }
      else { out.status = 'not evidenced'; out.note = `Requires ${need} years; ${ev.years} recorded.`; }
      out.evidence = ev.items.filter((i) => i.kind === 'discipline' && i.competencies.some((c) => r.competencies.includes(c))).map((i) => i.id);
    } else if (r.type === 'certification') {
      const certs = ev.items.filter((i) => i.kind === 'certification');
      const named = (r.certs || []).map((c) => norm(c));
      const hit = certs.filter((c) => named.length ? named.some((nm) => norm(c.title).includes(nm)) : c.competencies.some((x) => r.competencies.includes(x)));
      const active = hit.filter((c) => c.status !== 'expired');
      if (active.length) { out.status = named.length ? 'met' : 'likely met'; out.evidence = active.map((c) => c.id); out.note = 'Matching current credential on record.'; }
      else if (hit.length) { out.status = 'expired'; out.evidence = hit.map((c) => c.id); out.note = 'Matching credential is expired — renew before citing it as current.'; }
      else { out.status = 'not evidenced'; out.note = named.length ? `No ${r.certs.join(', ')} credential on record.` : 'No matching credential on record.'; }
    } else if (r.type === 'language') {
      out.status = 'needs verification';
      out.note = ev.dataQuality.hasLanguages ? 'Confirm proficiency level.' : 'credentials.json records no languages — add them so this can be checked.';
    } else if (r.type === 'eligibility') {
      out.status = 'manual check';
      out.note = 'Legal or administrative eligibility (citizenship, authorization, civil-service eligibility, clearance) is never decided automatically.';
    }
    return out;
  }

  /* ---------------------------------------------------------------- assess */
  const val = (f) => (f && f.value != null ? f.value : null);

  function assess(job, creds, opts) {
    const options = opts || {};
    const today = options.today || new Date();
    const settings = options.settings || {};
    const ev = options.evidence || buildEvidenceIndex(creds, { today });
    const F = job.fields;
    const weights = job.competencyWeights || {};
    const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
    const compIds = Object.keys(weights).sort((a, b) => weights[b] - weights[a]);

    /* --- eligibility (explicit checks with sources) --- */
    const checkable = job.requirements.filter((r) => ['education', 'experience', 'certification', 'language', 'eligibility'].includes(r.type) && (r.priority === 'mandatory' || r.priority === 'unspecified' || r.type === 'eligibility'));
    const checks = checkable.map((r) => checkRequirement(r, ev));
    const preferredChecks = job.requirements.filter((r) => ['education', 'certification', 'experience'].includes(r.type) && r.priority === 'preferred').map((r) => checkRequirement(r, ev));
    const blocking = checks.filter((c) => c.priority === 'mandatory' && (c.status === 'not evidenced' || c.status === 'expired') && (c.type === 'education' || c.type === 'certification'));
    const eligibility = {
      status: blocking.length ? 'likely ineligible' : checks.some((c) => c.status === 'needs verification' || c.status === 'manual check' || c.status === 'not evidenced') ? 'review required' : checks.length ? 'no disqualifier detected' : 'no mandatory criteria detected',
      checks, preferred: preferredChecks,
      note: 'Eligibility is decision support. Mandatory legal, educational and professional requirements must be confirmed against the source posting.'
    };

    /* --- A. professional alignment --- */
    const parts = {};
    const why = {};
    const mand = checks.filter((c) => c.priority === 'mandatory' || c.type === 'eligibility');
    parts.mandatory = mand.length ? round(100 * mand.reduce((a, c) => a + STATUS_SCORE[c.status], 0) / mand.length) : 65;
    why.mandatory = mand.length ? `${mand.filter((c) => c.status === 'met' || c.status === 'likely met').length} of ${mand.length} mandatory criteria met or likely met` : 'No mandatory criteria detected — score is neutral';

    parts.competencies = totalW ? round(100 * compIds.reduce((a, c) => a + weights[c] * (ev.strength[c] || 0), 0) / totalW) : 50;
    const strongC = compIds.filter((c) => c !== 'unmapped' && (ev.strength[c] || 0) >= 0.6).slice(0, 3).map((c) => TAX_BY_ID[c].label.toLowerCase());
    const weakC = compIds.filter((c) => (ev.strength[c] || 0) < 0.4 && weights[c] / (totalW || 1) >= 0.08).slice(0, 2).map((c) => TAX_BY_ID[c].label.toLowerCase());
    why.competencies = totalW ? (strongC.length ? `Well evidenced: ${strongC.join(', ')}` : 'No required competency is strongly evidenced') + (weakC.length ? `; weak: ${weakC.join(', ')}` : '') : 'No competencies recognized in the posting';

    const projItems = ev.items.filter((i) => i.kind === 'project');
    const projRank = projItems.map((p) => {
      const shared = p.competencies.filter((c) => weights[c]);
      const cov = totalW ? shared.reduce((a, c) => a + weights[c], 0) / totalW : 0;
      const sectorBonus = val(F.sector) && p.sector === val(F.sector) ? 0.1 : 0;
      const quality = 0.85 + 0.15 * (p.completeness / 4);   /* better-documented records rank higher */
      return { id: p.id, title: p.title, sector: p.sector, year: p.year, role: p.role, completeness: p.completeness, shared, score: Math.min(1, (cov + sectorBonus) * quality) };
    }).filter((x) => x.shared.length).sort((a, b) => b.score - a.score || (b.year || 0) - (a.year || 0));
    const pTop = projRank.slice(0, 3).map((x) => x.score);
    parts.projects = round(clamp(100 * Math.min(1, (pTop[0] || 0) + 0.5 * (pTop[1] || 0) + 0.25 * (pTop[2] || 0)), 0, 100)) || (projRank.length ? 20 : 15);
    why.projects = projRank.length ? `${projRank.length} documented projects share required competencies; strongest: ${projRank[0].title}` : 'No documented project shares the required competencies';

    const jl = val(F.seniority);
    const pl = ev.profileLevel;
    parts.leadership = jl == null ? 70 : jl <= pl ? 90 : jl === pl + 1 ? 65 : 45;
    why.leadership = jl == null ? 'Seniority not identified' : jl <= pl ? 'Profile seniority meets the role level' : 'Role level is above documented seniority — document executive leadership evidence';
    if (jl != null && pl - jl >= 2) why.leadership += ' (role may be below current seniority)';

    const sec = val(F.sector);
    const secProjects = sec ? projItems.filter((p) => p.sector === sec).length : 0;
    const orgName = String(val(F.organization) || '').toLowerCase();
    const instHit = orgName.length > 2 && (creds.institutions || []).some((i) => { const l = i.toLowerCase(); return l.includes(orgName) || (orgName.includes(l) && l.length > 3); });
    parts.sector = clamp((sec == null ? 60 : secProjects >= 3 ? 85 : secProjects >= 1 ? 68 : 45) + (instHit ? 10 : 0));
    why.sector = (sec ? `${secProjects} documented projects in the ${sec} sector` : 'Sector not identified') + (instHit ? '; prior engagement with this institution' : '');

    const locN = norm([val(F.location), val(F.remote)].join(' '));
    const projText = norm(projItems.map((p) => p.title + ' ' + (p.keywords || []).join(' ') + ' ' + (p.client || '')).join(' ; '));
    const phHit = PH_PLACES.filter((pl2) => has(locN, pl2));
    const phDoc = phHit.filter((pl2) => pl2 !== 'philippines' && has(projText, pl2));
    parts.geography = !val(F.location) && !val(F.remote) ? 60 : phDoc.length ? 95 : phHit.length ? 88 : val(F.remote) ? 80 : ASIA_PAC.some((a) => has(locN, a)) ? 70 : 45;
    why.geography = phDoc.length ? `Documented work in ${phDoc.join(', ')}` : phHit.length ? 'Philippine posting' : val(F.location) ? 'Outside documented geographic experience' : 'Location not identified';

    const lvlAvg = totalW ? compIds.reduce((a, c) => a + weights[c] * LEVELS[ev.bestLevel[c] || 'unknown'].w, 0) / totalW : 0.4;
    parts.evidence = round(100 * lvlAvg);
    why.evidence = 'Average quality of the best evidence available for each required competency';

    const pathScores = PATHWAYS.map((pw) => ({ id: pw.id, label: pw.label, positioning: pw.positioning, cv: pw.cv,
      share: totalW ? pw.competencies.reduce((a, c) => a + (weights[c] || 0), 0) / totalW : 0 })).sort((a, b) => b.share - a.share);
    const topPath = pathScores[0];
    const prios = settings.pathwayPriorities || {};
    const prio = (id) => (prios[id] != null ? Number(prios[id]) : 3);
    parts.direction = topPath && topPath.share > 0 ? round(prio(topPath.id) / 5 * 100) : 50;
    why.direction = topPath && topPath.share > 0 ? `Closest pathway: ${topPath.label} (priority ${prio(topPath.id)}/5${prios[topPath.id] == null ? ', default — set in Settings' : ''})` : 'No pathway recognized';

    /* Domain-relevance gate: seniority, sector, geography and direction only
       carry meaning when the work itself matches. When most of the demand is
       unmapped, those contextual factors are scaled down. */
    const unmappedShare = totalW ? (weights.unmapped || 0) / totalW : 0;
    const gate = clamp(1 - Math.max(0, unmappedShare - 0.2), 0.4, 1);
    if (gate < 1) {
      ['leadership', 'sector', 'geography', 'direction'].forEach((k) => {
        parts[k] = round(parts[k] * gate);
        why[k] += ` — scaled ×${gate.toFixed(2)}: ${round(unmappedShare * 100)}% of the requirements fall outside the recorded competencies`;
      });
    }
    const alignment = round(Object.entries(ALIGNMENT_WEIGHTS).reduce((a, [k, w]) => a + parts[k] * w, 0) / 100);

    /* --- B. application feasibility --- */
    const dl = F.deadline && F.deadline.value ? new Date(F.deadline.value + 'T23:59:59') : null;
    const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const days = dl ? Math.round((Date.UTC(dl.getFullYear(), dl.getMonth(), dl.getDate()) - todayStart.getTime()) / 86400000) : null;
    const prepDays = Math.max(1, round(1 + job.documents.reduce((a, d) => a + (d.readiness === 'ready' || d.readiness === 'generated' ? d.effort * 0.5 : d.effort), 0)));
    let timeScore;
    if (days == null) timeScore = 60;
    else if (days < 0) timeScore = 0;
    else { const r = days / prepDays; timeScore = r >= 3 ? 100 : r >= 2 ? 85 : r >= 1.25 ? 70 : r >= 1 ? 55 : r >= 0.5 ? 30 : 10; }
    const docsNeeding = job.documents.filter((d) => d.readiness === 'prepare' || d.readiness === 'verify');
    const docScore = clamp(100 - docsNeeding.reduce((a, d) => a + (d.effort >= 3 ? 30 : 12), 0));
    const eligScore = eligibility.status === 'likely ineligible' ? 10 : eligibility.status === 'review required' ? 65 : 95;
    const condText = job.text.toLowerCase();
    let condScore = 85; const condNotes = [];
    if (/\b(relocat\w*|must be based|willing to (travel|be deployed)|deployment to|field based|hardship)\b/.test(condText)) { condScore -= 20; condNotes.push('relocation or field deployment'); }
    if (/\b(full[- ]time (on[- ]site|presence)|on[- ]site only)\b/.test(condText)) { condScore -= 10; condNotes.push('on-site presence'); }
    if (/\b(nationals? only|filipino citizens? only|national position)\b/.test(condText)) { condNotes.push('nationality restriction — check eligibility'); }
    const feasibilityParts = { time: timeScore, documents: docScore, eligibility: eligScore, conditions: clamp(condScore) };
    const feasibility = days != null && days < 0 ? 0 : round(Object.entries(FEASIBILITY_WEIGHTS).reduce((a, [k, w]) => a + feasibilityParts[k] * w, 0) / 100);

    const timePriority = days == null ? { label: 'Deadline unknown', code: 'unknown' }
      : days < 0 ? { label: 'Closed', code: 'closed' }
        : days <= 3 ? { label: 'Act now', code: 'urgent' }
          : days <= 7 ? { label: 'This week', code: 'week' }
            : days <= 21 ? { label: 'Plan this month', code: 'plan' } : { label: 'Monitor', code: 'monitor' };

    /* --- C. career value --- */
    const gainScore = jl == null ? 60 : jl > pl ? 100 : jl === pl ? 75 : jl === pl - 1 ? 50 : 30;
    const orgAll = String(val(F.organization) || '') + ' ' + job.text.slice(0, 1500);
    const instScore = MULTILATERAL.test(orgAll) ? 90 : sec === 'government' ? 75 : sec === 'humanitarian' ? 80 : sec === 'academic' ? 70 : sec === 'private' ? 60 : 55;
    const contribScore = /\b(policy|strateg\w*|research|framework|roadmap|design|architect\w*|publication|thought leadership)\b/i.test(job.text) ? 85 : 60;
    const durMonths = (() => { const d = val(F.duration); if (!d) return null; const m = String(d).match(/(\d+)\s*(month|week|day)/i); if (!m) return null; return m[2].toLowerCase().startsWith('month') ? +m[1] : m[2].toLowerCase().startsWith('week') ? +m[1] / 4 : +m[1] / 22; })();
    const et = val(F.employmentType);
    const contractScore = et === 'permanent' ? 80 : et === 'contract' ? 70 : et === 'consultancy' ? (durMonths != null && durMonths < 3 ? 55 : 70) : 60;
    const valueParts = { seniority: gainScore, pathway: topPath && topPath.share > 0 ? round(prio(topPath.id) / 5 * 100) : 50, institution: instScore, contribution: contribScore, contract: contractScore };
    const careerValue = round(Object.entries(VALUE_WEIGHTS).reduce((a, [k, w]) => a + valueParts[k] * w, 0) / 100);

    /* --- gaps: competency vs evidence vs credential vs eligibility --- */
    const gaps = [];
    compIds.forEach((c) => {
      const share = totalW ? weights[c] / totalW : 0;
      const s = ev.strength[c] || 0;
      const mandatoryHit = job.requirements.some((r) => r.priority === 'mandatory' && r.competencies.includes(c));
      if ((share < 0.06 && !mandatoryHit) || s >= 0.5) return;
      const ids = ev.byCompetency[c] || [];
      const docIds = ids.filter((id) => ['project', 'certification', 'training', 'membership', 'appointment'].includes(ev.byId[id].kind));
      const label = TAX_BY_ID[c].label;
      let type, detail, action;
      if (c === 'unmapped') {
        const n = job.requirements.filter((r) => r.unmapped).length;
        gaps.push({ id: 'gap:unmapped', competency: c, label, type: 'competency', severity: share >= 0.25 ? 'major' : 'minor', strength: 0,
          detail: `${n} requirement(s) could not be matched to any recorded competency (e.g., “${(job.requirements.find((r) => r.unmapped) || {}).text || ''}”). They count as unmet.`,
          action: 'Review these lines manually. If you do have this experience, add it to credentials.json so it can be evidenced.' });
        return;
      }
      if (!ids.length) {
        type = 'competency'; detail = `No evidence of ${label.toLowerCase()} in the professional record.`; action = DEV_ACTIONS[c] || DEV_ACTIONS.default;
      } else if (!docIds.length) {
        type = 'evidence'; detail = `${label} is claimed in profile disciplines but not supported by a documented project or credential.`;
        action = 'Document a project that demonstrates this competency (role, deliverables, results) before citing it.';
      } else {
        type = 'evidence'; detail = `${label} is supported by ${docIds.length} record(s) with thin detail (role, client or results not recorded).`;
        action = `Strengthen these records: ${docIds.slice(0, 3).map((id) => ev.byId[id].title).join('; ')}.`;
      }
      gaps.push({ id: 'gap:' + c, competency: c, label, type, severity: mandatoryHit ? 'major' : 'minor', detail, action, strength: round(s * 100) });
    });
    checks.concat(preferredChecks).forEach((ch) => {
      if (ch.status === 'met' || ch.status === 'likely met') return;
      const type = ch.type === 'certification' || ch.type === 'education' ? 'credential' : ch.type === 'language' && !ev.dataQuality.hasLanguages ? 'data' : 'eligibility';
      gaps.push({ id: 'gap:' + ch.id, competency: null, label: ch.type[0].toUpperCase() + ch.type.slice(1) + (ch.priority === 'preferred' ? ' (preferred)' : ''), type,
        severity: ch.priority === 'mandatory' && (ch.status === 'not evidenced' || ch.status === 'expired') ? 'blocking' : ch.priority === 'preferred' ? 'minor' : 'major',
        detail: `${ch.note} — “${ch.text.slice(0, 140)}”`, action: ch.status === 'expired' ? 'Renew the credential or present it with its validity dates.' : ch.status === 'manual check' ? 'Confirm against your documents before applying.' : ch.type === 'certification' ? 'Check whether an equivalent credential is acceptable; otherwise plan certification.' : 'Verify against the source posting and your records.' });
    });
    const sevRank = { blocking: 0, major: 1, minor: 2 };
    gaps.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

    /* --- confidence --- */
    let conf = 30;
    conf += F.title.confidence === 'high' || F.title.confidence === 'user' ? 10 : F.title.confidence === 'medium' ? 5 : 0;
    conf += F.organization.value ? 8 : 0;
    conf += F.deadline.value && !F.deadline.ambiguous ? 7 : 0;
    conf += job.requirements.length >= 5 ? 12 : job.requirements.length >= 2 ? 6 : 0;
    conf += job.structure.hasRequiredSection ? 8 : 0;
    conf += compIds.length >= 3 ? 10 : compIds.length ? 5 : 0;
    conf += round(lvlAvg * 14);
    conf = clamp(conf, 20, 95);
    const confidence = { score: conf, label: conf >= 75 ? 'High' : conf >= 55 ? 'Medium' : 'Low' };

    /* --- recommendation with reasons (D3) --- */
    let decision;
    if (days != null && days < 0) decision = { code: 'closed', label: 'Closed — record for analytics only' };
    else if (eligibility.status === 'likely ineligible') decision = { code: 'ineligible', label: 'Do not apply unless the flagged mandatory requirement can be met' };
    else if (alignment >= 75 && feasibility >= 60) decision = { code: 'pursue', label: 'Pursue' };
    else if (alignment >= 75) decision = { code: 'pursue-tight', label: 'Strong fit — pursue only if the application can be prepared in time' };
    else if (alignment >= 60 && careerValue >= 70) decision = { code: 'consider', label: 'Consider — strategic value may justify the effort' };
    else if (alignment >= 60) decision = { code: 'conditional', label: 'Conditional — address the gaps before applying' };
    else if (careerValue >= 80) decision = { code: 'stretch', label: 'Stretch opportunity — treat as a development target' };
    else decision = { code: 'deprioritize', label: 'Deprioritize' };
    const strengths = Object.entries(parts).filter(([, v]) => v >= 80).map(([k]) => why[k]);
    const blockers = gaps.filter((g) => g.severity !== 'minor').slice(0, 4).map((g) => `${g.label}: ${g.detail}`);
    if (timeScore <= 30 && days != null && days >= 0) blockers.unshift(`Only ${days} day(s) left against an estimated ${prepDays} preparation day(s).`);
    const strategic = [];
    if (valueParts.institution >= 85) strategic.push('Multilateral or donor-agency exposure');
    if (gainScore >= 100) strategic.push('Seniority step-up');
    if (valueParts.pathway >= 80) strategic.push(`High-priority pathway: ${topPath.label}`);
    if (contribScore >= 85) strategic.push('Room for strategic or intellectual contribution');

    const cvs = rankCVs(job, creds, ev);

    return {
      modelVersion: MODEL_VERSION,
      assessedAt: today.toISOString(),
      inputHash: hash([job.textHash, JSON.stringify(Object.fromEntries(Object.entries(F).map(([k, v]) => [k, v && v.value]))), MODEL_VERSION, hash(JSON.stringify(creds)), JSON.stringify(settings.pathwayPriorities || {})].join('|')),
      credentialsHash: hash(JSON.stringify(creds)),
      eligibility,
      alignment: { score: alignment, parts, why, weights: ALIGNMENT_WEIGHTS },
      feasibility: { score: feasibility, parts: feasibilityParts, days, prepDays, documents: job.documents, conditions: condNotes, weights: FEASIBILITY_WEIGHTS },
      careerValue: { score: careerValue, parts: valueParts, weights: VALUE_WEIGHTS },
      timePriority,
      confidence,
      decision: Object.assign(decision, { strengths, blockers, strategic }),
      competencies: compIds.map((c) => ({ id: c, label: TAX_BY_ID[c].label, weight: round(100 * weights[c] / (totalW || 1)), strength: round(100 * (ev.strength[c] || 0)), level: ev.bestLevel[c] || 'unknown', evidence: (ev.byCompetency[c] || []).slice(0, 6) })),
      projects: projRank.slice(0, 6).map((p) => Object.assign({}, p, { score: round(p.score * 100), shared: p.shared.map((c) => TAX_BY_ID[c].label) })),
      gaps,
      cvs,
      positioning: { primary: topPath, alternatives: pathScores.slice(1, 3).filter((x) => x.share > 0), pathways: pathScores },
      dataQuality: ev.dataQuality
    };
  }

  /* ------------------------------------------------------------ CV ranking */
  function rankCVs(job, creds, ev) {
    const weights = job.competencyWeights || {};
    const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    const discByName = Object.fromEntries((creds.disciplines || []).map((d) => [d.name, d]));
    const jobTokens = new Set(norm(job.text).trim().split(' ').filter((w) => w.length > 3));
    const sector = job.fields.sector && job.fields.sector.value;
    return (creds.cv_versions || []).map((cv) => {
      const backlinked = (creds.disciplines || []).filter((d) => d.cv === cv.file).map((d) => d.name);
      const comps = unique([].concat(
        ...unique((cv.disciplines || []).concat(backlinked)).map((n) => discByName[n] ? disciplineCompetencies(discByName[n]) : detectCompetencies(n).map((c) => c.id)),
        detectCompetencies((cv.keywords || []).join(' ; ')).map((c) => c.id)
      ));
      const coverage = comps.reduce((a, c) => a + (weights[c] || 0), 0) / totalW;
      const kw = (cv.keywords || []).map((k) => norm(k).trim()).filter(Boolean);
      const kwHits = kw.filter((k) => k.split(' ').every((t) => jobTokens.has(t) || t.length <= 3 && norm(job.text).includes(' ' + t + ' ')));
      const overlap = kw.length ? kwHits.length / Math.min(kw.length, 6) : 0;
      const titleN = norm(job.fields.title && job.fields.title.value);
      const titleHits = kw.filter((k) => has(titleN, k)).length;
      const kwScore = 0.4 * Math.min(1, overlap) + 0.6 * Math.min(1, titleHits / 2);
      const score = round(clamp(65 * Math.min(1, coverage) + 10 * (sector && cv.sector_focus === sector ? 1 : 0) + 25 * kwScore));
      const covered = Object.keys(weights).filter((c) => comps.includes(c)).sort((a, b) => weights[b] - weights[a]);
      const missing = Object.keys(weights).filter((c) => !comps.includes(c) && weights[c] / totalW >= 0.08).sort((a, b) => weights[b] - weights[a]);
      const advice = missing.slice(0, 3).map((c) => {
        const proj = (ev.byCompetency[c] || []).map((id) => ev.byId[id]).filter((i) => i.kind === 'project')
          .sort((a, b) => ((b.links && b.links[c] === 'strong') - (a.links && a.links[c] === 'strong')) || (b.completeness - a.completeness) || ((b.year || 0) - (a.year || 0)))[0];
        return `Add ${TAX_BY_ID[c].label.toLowerCase()}${proj ? ` — cite ${proj.title}` : ' — no documented project; do not overstate'}`;
      });
      return { file: cv.file, disciplines: cv.disciplines || [], sector_focus: cv.sector_focus || null, score,
        covered: covered.map((c) => TAX_BY_ID[c].label), keywordHits: kwHits, advice };
    }).sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
      .map((cv, i) => (i < 2 ? cv : Object.assign(cv, { advice: [] })));
  }

  /* ---------------------------------------------------------------- claims */
  const LEVEL_ORDER = ['verified', 'documented', 'self-reported', 'unverified', 'inferred'];
  function firstSentence(s) {
    const t = clean(s);
    const m = t.match(/^(.{20,200}?[.;])(\s|$)/);
    if (m) return m[1].replace(/;$/, '.');
    if (t.length <= 180) return t;
    const cut = t.slice(0, 180).replace(/[,;:]?\s+\S*$/, '');
    return cut + '…';
  }

  /**
   * Evidence-backed claims a letter may use. Each claim carries its source
   * and level; `selected` is the default only. Inferred and unverified claims
   * are never selected by default and are labelled in the UI.
   */
  function buildClaims(job, result, creds) {
    const p = creds.profile || {};
    const notes = p._metric_notes || {};
    const ev = buildEvidenceIndex(creds);
    const claims = [];
    const add = (c) => claims.push(Object.assign({ selected: false }, c));
    const topComp = result.competencies.slice(0, 3).map((c) => c.id);

    if (p.years_total) add({ id: 'm:years', group: 'metric', level: 'self-reported', source: 'credentials.json › profile.years_total', text: `${p.years_total}+ years of professional experience in development management and related practice`, selected: true });
    if (p.countries) add({ id: 'm:countries', group: 'metric', level: /unverified/i.test(notes.countries || '') ? 'unverified' : 'self-reported', source: 'credentials.json › profile.countries', text: `work across ${p.countries} countries`, selected: !/unverified/i.test(notes.countries || '') });
    if (p.funding_designed) add({ id: 'm:funding', group: 'metric', level: /unverified/i.test(notes.funding_designed || '') ? 'unverified' : 'self-reported', source: 'credentials.json › profile.funding_designed', text: `${p.funding_designed} in total project value designed across engagements`, selected: topComp.some((c) => ['climate_finance', 'cca', 'private_sector', 'strategy', 'pm'].includes(c)) && !/unverified/i.test(notes.funding_designed || '') });
    if (p.households_reached) add({ id: 'm:households', group: 'metric', level: /unverified/i.test(notes.households_reached || '') ? 'unverified' : 'self-reported', source: 'credentials.json › profile.households_reached', text: `${p.households_reached} households reached`, selected: false, warning: /unverified/i.test(notes.households_reached || '') ? 'Marked UNVERIFIED in credentials.json — confirm before use.' : null });

    result.projects.slice(0, 5).forEach((pr, i) => {
      const it = ev.byId[pr.id];
      if (!it) return;
      const where = [it.client ? `for ${it.client}` : '', it.year ? `(${it.year})` : ''].filter(Boolean).join(' ');
      const text = it.description
        ? `${it.title}${where ? ' ' + where : ''}: ${firstSentence(it.description)}`
        : `${it.title}${where ? ' ' + where : ''}, work relating to ${pr.shared.slice(0, 3).join(', ').toLowerCase()}`;
      add({ id: 'p:' + it.id, group: 'project', level: 'documented', source: `credentials.json › projects › ${it.title}`, text,
        selected: i < 2, warning: it.role ? null : 'Role not recorded — the letter describes the work, not your position on it.' });
    });

    ev.items.filter((i) => i.kind === 'degree').forEach((d, i) => add({ id: 'd:' + i, group: 'credential', level: 'documented', source: 'credentials.json › profile.degrees', text: d.title, selected: i === 0 }));
    ev.items.filter((i) => i.kind === 'certification').forEach((c) => {
      const relevant = c.competencies.some((x) => result.competencies.find((rc) => rc.id === x));
      if (!relevant) return;
      const expired = c.status === 'expired';
      const years = [c.issued && c.issued.slice(0, 4), c.expires && c.expires.slice(0, 4)].filter(Boolean).join('–');
      add({ id: 'c:' + c.id, group: 'credential', level: c.level, source: `credentials.json › certifications › ${c.title}`,
        text: expired ? `${c.title} (${c.issuer.split('(')[0].trim()}, ${years}; expired)` : `${c.title} — ${c.issuer}${c.issued ? ` (${c.issued.slice(0, 4)})` : ''}`,
        selected: !expired, warning: expired ? 'Expired — only cite with validity dates.' : null });
    });
    ev.items.filter((i) => i.kind === 'membership').forEach((m) => add({ id: 'mb:' + m.id, group: 'credential', level: m.level, source: 'credentials.json › memberships', text: `${m.title}${m.reference ? ` (${m.reference})` : ''}`, selected: m.competencies.some((x) => topComp.includes(x)) }));
    ev.items.filter((i) => i.kind === 'training').forEach((t) => { if (t.competencies.some((x) => topComp.includes(x))) add({ id: 't:' + t.id, group: 'credential', level: t.level, source: 'credentials.json › technical_training', text: t.title, selected: true }); });
    const books = ev.items.filter((i) => i.kind === 'publication' && i.pubType === 'book');
    if (books.length) add({ id: 'pub:books', group: 'publication', level: 'documented', source: 'credentials.json › publications', text: `author of ${books.length} books, including ${books.slice(0, 2).map((b) => `“${b.title}”`).join(' and ')}`, selected: topComp.includes('research') || topComp.includes('communications') });

    return claims.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
  }

  function listJoin(xs) { return xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; }

  /** Compose a letter only from selected claims. */
  function composeLetter(job, result, creds, claims, opts) {
    const o = Object.assign({ tone: 'formal', acknowledgeGaps: false, siteUrl: 'https://alvin-silva.asilvainnovations.com' }, opts || {});
    const p = creds.profile || {};
    const sel = (claims || []).filter((c) => c.selected);
    const role = (job.fields.title && job.fields.title.value) || 'advertised position';
    const org = (job.fields.organization && job.fields.organization.value) || 'your organization';
    const pos = result.positioning.primary && result.positioning.primary.share > 0 ? result.positioning.primary.positioning : null;
    const comps = result.competencies.filter((c) => c.strength >= 40 && c.weight >= 12).slice(0, 2).map((c) => c.label.charAt(0).toLowerCase() + c.label.slice(1));
    const metrics = sel.filter((c) => c.group === 'metric').map((c) => c.text);
    const projects = sel.filter((c) => c.group === 'project').map((c) => c.text);
    const creds2 = sel.filter((c) => c.group === 'credential').map((c) => c.text);
    const pubs = sel.filter((c) => c.group === 'publication').map((c) => c.text);

    const out = [];
    out.push(o.tone === 'concise' ? 'Dear Hiring Committee,' : 'Dear Hiring Committee,', '');
    out.push(`I am writing to apply for the ${role} position at ${org}.` + (pos ? ` My practice is that of a ${pos.replace(/^([A-Z])([a-z])/, (m, a, b) => a.toLowerCase() + b)}${comps.length ? `, with particular depth in ${listJoin(comps)}` : ''}.` : ''));
    if (metrics.length) { out.push(''); out.push(`My background includes ${listJoin(metrics)}.`); }
    if (projects.length) {
      out.push('');
      out.push(o.tone === 'concise' ? 'Relevant work:' : 'Work in my portfolio that relates directly to this role includes:');
      projects.forEach((t) => out.push('• ' + t));
    }
    if (creds2.length || pubs.length) {
      out.push('');
      out.push('Relevant qualifications:');
      creds2.concat(pubs.map((x) => x[0].toUpperCase() + x.slice(1))).forEach((t) => out.push('• ' + t));
    }
    if (o.acknowledgeGaps) {
      const g = result.gaps.find((x) => x.type === 'evidence' || x.type === 'competency');
      if (g) { out.push(''); out.push(`Where the role emphasizes ${g.label.toLowerCase()}, I would welcome the chance to discuss how my related experience applies.`); }
    }
    if (o.tone !== 'concise') { out.push(''); out.push(`I would welcome the opportunity to discuss how this experience can support ${org}'s objectives.`); }
    out.push('', 'Sincerely,', '', p.name || 'Alvin M. Silva, MDM');
    [p.email, p.phone, o.siteUrl].filter(Boolean).forEach((x) => out.push(x));
    return out.join('\n');
  }

  return {
    MODEL_VERSION, ALIGNMENT_WEIGHTS, FEASIBILITY_WEIGHTS, VALUE_WEIGHTS, LEVELS, TAXONOMY, PATHWAYS, DEV_ACTIONS,
    norm, hash, slug, detectCompetencies, parseDate, findDeadline, segment, extractJob, applyEdits,
    buildEvidenceIndex, checkRequirement, assess, rankCVs, buildClaims, composeLetter
  };
});
