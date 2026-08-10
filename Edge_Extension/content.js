// ASilva Form Assistant — Content Script v2.0
// ================================================================
// Injected on-demand by background.js when the user clicks the toolbar
// icon. Scans the active page for form fields, maps them to Alvin
// Silva's structured profile, and renders an interactive suggestion
// panel with confidence scoring, validation, undo, and sensitive-field
// protection.
//
// Wrapped in an IIFE so re-injection on the same tab is always safe
// (MV3 content scripts persist in the tab's isolated world).

(function () {
  'use strict';

  /* ================================================================
     0. TOGGLE / MESSAGE HANDLER (content-script ↔ background)
     ================================================================ */
  if (window.__asilvaFormAssistantReady) {
    // Already loaded — background.js sent a "toggle" message.
    // Just close the panel if it exists, or re-open if it doesn't.
    const existing = document.getElementById('asilva-fa-panel');
    if (existing) { existing.remove(); window.__asilvaFormAssistantPanelOpen = false; }
    else { init(); }
    return;
  }
  window.__asilvaFormAssistantReady = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.action === 'toggle') {
      const existing = document.getElementById('asilva-fa-panel');
      if (existing) { existing.remove(); window.__asilvaFormAssistantPanelOpen = false; }
      else { init(); }
      sendResponse({ ok: true });
      return true;
    }
  });

  /* ================================================================
     1. PROFILE DATA (structured, 24 keys)
     ================================================================ */
  const PROFILE = {
    name: "Alvin M. Silva, MDM",
    title: "Development Management Professional & Resilience Consultant",
    email: "alvin.silva@asilvainnovations.com",
    phone: "+63 917 855 5134",
    linkedin: "https://alvin-silva-linkedin.asilvainnovations.com",
    degrees: "MDM — Master in Development Management, Asian Institute of Management",
    certifications: "Certified SRMP (Security Risk Management Professional), Certified International Humanitarian Practitioner, Certified DRR Practitioner",
    years_experience: "18+",
    countries: "15",
    funding_designed: "₱190M",
    households_reached: "50,000+",
    completion_rate: "100%",
    strategic_plans: "20",
    frameworks_published: "10",
    university_collaborations: "5",
    books_published: "3",
    summary: "Development Management Professional & Resilience Consultant with 18+ years across 15 countries. Architect of BIRD 2026-2035, DDRiVE-M, and Strat Planner Pro. Published author of three books including 'Personal Resilience: The Path to Oneness' (2025). MDM, Asian Institute of Management.",
    skills: "Strategic Planning, Climate Change Adaptation, Disaster Risk Reduction, Systems Innovation, Organizational Development, Capacity Building, Security Risk Management, Monitoring & Evaluation, Policy Research, Project Management, Investment Roadmapping, Stakeholder Facilitation",
    disciplines: "Climate Change Adaptation (15 yrs), Disaster Risk Reduction (15 yrs), Systems Innovation (10 yrs), Organizational Development (12 yrs), Strategic Thinking & Planning (18 yrs), Capacity Building (15 yrs), Security Risk Management (10 yrs)",
    projects: "BIRD 2026-2035 (Bangsamoro Investment Roadmap), DDRiVE-M Platform, Strat Planner Pro, RTL — Real-Time Leadership, Cognitio+, Balatan Climate Resilience Hub (₱190M), TESDA Strategic Plan 2026-2030, Risk-Informed CDP Salcedo, MHPSS Intervention Module (WHO/DOH), IRRM BARMM (USAID/Action Against Hunger)",
    publications: "Personal Resilience: The Path to Oneness (2025); Resilient Futures: Nurturing Oneness in Education (2024); Building Resilience: The Path to a More Fulfilling Life (2023); Shock-Responsive & Sustainable Livelihoods Process Manual (2022)",
    institutions: "UNICEF, UNDP, ECHO, USAID, World Bank, WHO, TESDA, MMDA, DOH, BARMM BoI-MTIT, Action Against Hunger, Asian Institute of Management, SOLHUM, Philippine Red Cross, German Red Cross, DLSU",
    references: "Available upon request",
    salary: "Negotiable based on role scope and organizational mandate",
    start_date: "Immediately available for strategic roles aligned with resilience and systems innovation",
    why_hire: "I bring a systems-level perspective grounded in measurable outcomes — ₱190M in climate-smart funding designed, 50,000+ households reached, 100% project completion rate. My decade-scale roadmaps (BIRD 2026-2035, TESDA Strategic Plan) demonstrate the ability to align institutional vision with executable frameworks. I architect platforms, not just documents — DDRiVE-M, Strat Planner Pro, and Cognitio+ are live tools that outlast engagements.",
    cover_letter: "Dear Hiring Committee,\n\nWith 18+ years of development management experience across 15 countries, I have consistently delivered systems-level solutions that outlast project cycles. As lead architect of the Bangsamoro Investment Roadmap 2026-2035 and sole author of the TESDA Strategic Plan 2026-2030, I bring proven ability to translate institutional vision into executable frameworks.\n\nMy approach integrates climate adaptation, disaster risk reduction, and organizational performance — disciplines typically kept in silos. I have designed ₱190M in climate-smart projects, trained emergency responders with WHO, and published three books on resilience methodology.\n\nI am available immediately for roles that demand strategic thinking, stakeholder alignment, and measurable outcomes.\n\nRespectfully,\nAlvin M. Silva, MDM"
  };

  /* ================================================================
     2. FIELD MAPPING RULES (23 rules, with types, priorities, sensitivity)
     ================================================================ */
  const FIELD_RULES = [
    { key: 'name',      keywords: ['name','full name','applicant name','candidate name','your name','first and last name'], type: 'text', priority: 100 },
    { key: 'email',     keywords: ['email','e-mail','contact email','your email','mail address','email address'], type: 'email', priority: 100 },
    { key: 'phone',     keywords: ['phone','mobile','contact number','telephone','cell','cellphone','mobile number','phone number'], type: 'tel', priority: 100 },
    { key: 'linkedin',  keywords: ['linkedin','linked in','profile url','social profile','linkedin url','linked-in'], type: 'url', priority: 90 },
    { key: 'degrees',   keywords: ['degree','education','qualification','academic','highest degree','educational background','degree earned'], type: 'text', priority: 80 },
    { key: 'certifications', keywords: ['certification','license','credential','professional cert','certifications','licenses'], type: 'text', priority: 80 },
    { key: 'years_experience', keywords: ['experience','years','professional experience','years of experience','work experience','total experience'], type: 'text', priority: 80 },
    { key: 'summary',   keywords: ['summary','profile','about','bio','overview','personal statement','professional summary','career summary','about yourself','tell us about yourself'], type: 'textarea', priority: 70 },
    { key: 'skills',    keywords: ['skill','competency','expertise','technical skill','core competency','key skills','specializations','capabilities'], type: 'textarea', priority: 70 },
    { key: 'disciplines', keywords: ['discipline','area of expertise','field of practice','technical areas','practice areas'], type: 'textarea', priority: 65 },
    { key: 'projects',  keywords: ['project','portfolio','key projects','relevant projects','project experience'], type: 'textarea', priority: 65 },
    { key: 'publications', keywords: ['publication','book','paper','research','published work','authored works','publications'], type: 'textarea', priority: 60 },
    { key: 'institutions', keywords: ['institution','organization','affiliation','employer','previous employer','worked with'], type: 'textarea', priority: 60 },
    { key: 'why_hire',  keywords: ['why','motivation','cover letter','statement of purpose','why hire','why you','why should we hire','coverletter','statement','personal statement'], type: 'textarea', priority: 60 },
    { key: 'cover_letter', keywords: ['cover letter','coverletter','letter of intent','application letter','motivation letter'], type: 'textarea', priority: 60 },
    { key: 'salary',    keywords: ['salary','compensation','expected salary','pay','remuneration','desired salary','expected pay','wage'], type: 'text', priority: 50, sensitive: true },
    { key: 'start_date', keywords: ['start','availability','notice','when can you start','available from','notice period','earliest start','start date'], type: 'text', priority: 50 },
    { key: 'references', keywords: ['reference','referee','professional reference','character reference'], type: 'textarea', priority: 40 },
    { key: 'funding_designed', keywords: ['funding','budget','grant','financial','project value','funding designed'], type: 'text', priority: 40 },
    { key: 'households_reached', keywords: ['household','beneficiary','reach','population served','beneficiaries'], type: 'text', priority: 40 },
    { key: 'countries', keywords: ['country','countries','nation','geographic coverage','regions'], type: 'text', priority: 40 },
    { key: 'completion_rate', keywords: ['completion','success rate','delivery rate','project completion'], type: 'text', priority: 30 },
    { key: 'title',     keywords: ['title','job title','position','current position','professional title'], type: 'text', priority: 30 }
  ];

  const SENSITIVE_PATTERNS = ['password','credit','card','cvv','ssn','social security','tax id','tin','bank account','routing','iban'];

  /* ================================================================
     3. UTILITIES
     ================================================================ */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function similarity(a, b) {
    a = String(a).toLowerCase().replace(/[^a-z0-9]/g, '');
    b = String(b).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.85;
    let matches = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) matches++;
    return matches / Math.max(a.length, b.length);
  }

  function isSensitiveInput(input, labelText) {
    const text = (labelText + ' ' + (input.name || '') + ' ' + (input.id || '') + ' ' + (input.getAttribute('aria-label') || '')).toLowerCase();
    return SENSITIVE_PATTERNS.some(p => text.includes(p));
  }

  function isEditable(input) {
    if (input.disabled || input.readOnly) return false;
    const type = (input.type || input.getAttribute('type') || 'text').toLowerCase();
    const tag = input.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'select') return true;
    if (tag === 'input') {
      return !['hidden','submit','button','reset','image','file'].includes(type);
    }
    return false;
  }

  /* ================================================================
     4. FIELD DETECTOR (5 strategies)
     ================================================================ */
  function findLabel(input) {
    if (input.id) {
      const label = document.querySelector('label[for="' + input.id.replace(/"/g, '\\"') + '"]');
      if (label) return label.textContent.trim();
    }
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();
    let prev = input.previousElementSibling;
    while (prev) {
      if (prev.tagName === 'LABEL' || prev.textContent.trim()) return prev.textContent.trim();
      prev = prev.previousElementSibling;
    }
    const aria = input.getAttribute('aria-label');
    if (aria) return aria.trim();
    return '';
  }

  function detectFields() {
    const inputs = $$('input, textarea, select');
    const fields = [];
    inputs.forEach((input, idx) => {
      if (!isEditable(input)) return;
      const label = findLabel(input);
      const name = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      const type = (input.type || input.getAttribute('type') || 'text').toLowerCase();
      const tag = input.tagName.toLowerCase();
      const context = (label + ' ' + name + ' ' + id + ' ' + placeholder).toLowerCase();
      fields.push({ element: input, label, name, id, placeholder, type, tag, context, index: idx });
    });
    return fields;
  }

  /* ================================================================
     5. MAPPING ENGINE (confidence scoring)
     ================================================================ */
  function mapFields(fields) {
    const mappings = [];
    const usedKeys = new Set();

    fields.forEach(field => {
      let bestMatch = null;
      let bestScore = 0;

      FIELD_RULES.forEach(rule => {
        if (usedKeys.has(rule.key) && rule.type !== 'textarea') return;
        let score = 0;
        const ctx = field.context;

        // Strategy 1: Exact name match
        if (field.name && rule.keywords.some(k => field.name === k)) score = Math.max(score, 1.0);
        // Strategy 2: Name contains keyword
        else if (field.name && rule.keywords.some(k => field.name.includes(k))) score = Math.max(score, 0.95);
        // Strategy 3: Exact id match
        if (field.id && rule.keywords.some(k => field.id === k)) score = Math.max(score, 0.95);
        // Strategy 4: Id contains keyword
        else if (field.id && rule.keywords.some(k => field.id.includes(k))) score = Math.max(score, 0.85);
        // Strategy 5: Label contains keyword
        if (field.label && rule.keywords.some(k => ctx.includes(k))) score = Math.max(score, 0.8);
        // Strategy 6: Placeholder contains keyword
        if (field.placeholder && rule.keywords.some(k => field.placeholder.includes(k))) score = Math.max(score, 0.75);
        // Strategy 7: Heuristic similarity
        const sim = rule.keywords.reduce((max, k) => Math.max(max, similarity(ctx, k)), 0);
        if (sim > 0.6) score = Math.max(score, sim * 0.7);

        // Type bonus
        if (score > 0.5 && rule.type && field.type === rule.type) score += 0.05;
        if (score > 0.5 && rule.type === 'textarea' && field.tag === 'textarea') score += 0.1;

        if (score > bestScore && score >= 0.35) {
          bestScore = score;
          bestMatch = rule;
        }
      });

      if (bestMatch) {
        const value = PROFILE[bestMatch.key];
        if (value !== undefined) {
          mappings.push({
            field,
            rule: bestMatch,
            value: String(value),
            confidence: bestScore,
            sensitive: bestMatch.sensitive || isSensitiveInput(field.element, field.label)
          });
          if (bestMatch.type !== 'textarea') usedKeys.add(bestMatch.key);
        }
      }
    });

    mappings.sort((a, b) => b.confidence - a.confidence);
    return mappings;
  }

  /* ================================================================
     6. VALIDATOR
     ================================================================ */
  function validateAndFormat(mapping) {
    const input = mapping.field.element;
    let value = mapping.value;
    const warnings = [];

    const maxLen = input.getAttribute('maxlength');
    if (maxLen && value.length > parseInt(maxLen, 10)) {
      value = value.substring(0, parseInt(maxLen, 10));
      warnings.push('Truncated to ' + maxLen + ' chars');
    }

    const minLen = input.getAttribute('minlength');
    if (minLen && value.length < parseInt(minLen, 10)) {
      warnings.push('Below minimum ' + minLen + ' chars');
    }

    const pattern = input.getAttribute('pattern');
    if (pattern && value) {
      try {
        const re = new RegExp('^(?:' + pattern + ')$');
        if (!re.test(value)) warnings.push('Does not match required pattern');
      } catch (e) {}
    }

    const type = input.type || 'text';
    if (type === 'number' && isNaN(Number(value))) warnings.push('Expected numeric value');
    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) warnings.push('Invalid email format');
    if (type === 'url' && !/^https?:\/\//.test(value)) warnings.push('Expected URL starting with http:// or https://');

    return { value, warnings };
  }

  /* ================================================================
     7. HISTORY (Undo stack)
     ================================================================ */
  const History = {
    stack: [],
    push(changes) {
      this.stack.push(changes);
      if (this.stack.length > 10) this.stack.shift();
    },
    undo() {
      if (this.stack.length === 0) return false;
      const changes = this.stack.pop();
      changes.forEach(c => {
        c.element.value = c.oldValue;
        c.element.dispatchEvent(new Event('input', { bubbles: true }));
        c.element.dispatchEvent(new Event('change', { bubbles: true }));
        c.element.style.borderColor = '';
        c.element.style.boxShadow = '';
      });
      return true;
    }
  };

  /* ================================================================
     8. UI RENDERER
     ================================================================ */
  let filledCount = 0;
  let totalCount = 0;
  let allMappings = [];

  function getConfidenceColor(score) {
    if (score >= 0.85) return '#0f7d51';
    if (score >= 0.6) return '#8a6d00';
    return '#c62828';
  }

  function getConfidenceLabel(score) {
    if (score >= 0.85) return 'High';
    if (score >= 0.6) return 'Medium';
    return 'Low';
  }

  function createPanel() {
    const existing = document.getElementById('asilva-fa-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'asilva-fa-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'ASilva Form Assistant');
    panel.style.cssText = 'position:fixed;top:16px;right:16px;width:420px;max-height:92vh;overflow:hidden;background:#fff;border:2px solid #FFD700;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.4);z-index:2147483647;font-family:"Poppins",system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.55;color:#0d1224;display:flex;flex-direction:column;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:14px 16px 10px;border-bottom:1px solid #e9ecf7;background:linear-gradient(135deg,#f8f9fb,#fff);border-radius:16px 16px 0 0;flex-shrink:0;';
    header.innerHTML = '<h2 style="margin:0;font-family:Montserrat,system-ui,sans-serif;font-size:15px;font-weight:800;background:linear-gradient(45deg,#0069a8,#0057c2,#8a6d00);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">ASilva Form Assistant</h2>';
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close assistant');
    closeBtn.style.cssText = 'background:none;border:none;font-size:22px;cursor:pointer;color:#999;line-height:1;padding:2px 6px;border-radius:6px;transition:.2s;';
    closeBtn.onmouseenter = () => closeBtn.style.background = '#f0f0f0';
    closeBtn.onmouseleave = () => closeBtn.style.background = 'none';
    closeBtn.onclick = () => { panel.remove(); window.__asilvaFormAssistantPanelOpen = false; };
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Counter
    const counter = document.createElement('div');
    counter.id = 'asilva-fa-counter';
    counter.style.cssText = 'padding:8px 16px;font-size:11px;color:#666;font-weight:600;border-bottom:1px solid #e9ecf7;background:#fafbfc;flex-shrink:0;';
    counter.textContent = 'Detecting form fields…';
    panel.appendChild(counter);

    // Filter
    const filterWrap = document.createElement('div');
    filterWrap.style.cssText = 'padding:8px 16px;border-bottom:1px solid #e9ecf7;flex-shrink:0;';
    const filterInput = document.createElement('input');
    filterInput.type = 'text';
    filterInput.placeholder = 'Search fields…';
    filterInput.setAttribute('aria-label', 'Search detected fields');
    filterInput.style.cssText = 'width:100%;padding:8px 12px;border:1px solid #d0d7de;border-radius:8px;font-family:inherit;font-size:12px;outline:none;box-sizing:border-box;';
    filterInput.onfocus = () => filterInput.style.borderColor = '#0069a8';
    filterInput.onblur = () => filterInput.style.borderColor = '#d0d7de';
    filterWrap.appendChild(filterInput);
    panel.appendChild(filterWrap);

    // Scrollable list
    const listWrap = document.createElement('div');
    listWrap.id = 'asilva-fa-list';
    listWrap.style.cssText = 'overflow-y:auto;flex:1;padding:8px 12px;';
    panel.appendChild(listWrap);

    // Footer actions
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:12px 16px;border-top:1px solid #e9ecf7;display:flex;gap:8px;flex-wrap:wrap;background:#fafbfc;border-radius:0 0 16px 16px;flex-shrink:0;';

    const btnStyle = 'padding:8px 14px;border-radius:999px;border:none;font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:12px;cursor:pointer;transition:.2s;flex:1;min-width:80px;';
    const fillAllBtn = document.createElement('button');
    fillAllBtn.textContent = 'Fill All';
    fillAllBtn.setAttribute('aria-label', 'Fill all detected fields');
    fillAllBtn.style.cssText = btnStyle + 'background:linear-gradient(135deg,#0057c2,#0069a8);color:#fff;';
    fillAllBtn.onmouseenter = () => fillAllBtn.style.boxShadow = '0 4px 12px rgba(0,105,168,.35)';
    fillAllBtn.onmouseleave = () => fillAllBtn.style.boxShadow = 'none';

    const undoBtn = document.createElement('button');
    undoBtn.textContent = 'Undo';
    undoBtn.setAttribute('aria-label', 'Undo last fill');
    undoBtn.style.cssText = btnStyle + 'background:#fff;color:#333;border:1px solid #d0d7de;';

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.setAttribute('aria-label', 'Clear all filled fields');
    clearBtn.style.cssText = btnStyle + 'background:#fff;color:#c62828;border:1px solid #d0d7de;';

    footer.appendChild(fillAllBtn);
    footer.appendChild(undoBtn);
    footer.appendChild(clearBtn);
    panel.appendChild(footer);

    // Toast
    const toast = document.createElement('div');
    toast.id = 'asilva-fa-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = 'position:absolute;bottom:70px;left:50%;transform:translateX(-50%) translateY(20px);padding:8px 16px;border-radius:999px;font-size:12px;font-weight:600;opacity:0;transition:all .35s;pointer-events:none;z-index:10;white-space:nowrap;';
    panel.appendChild(toast);

    document.body.appendChild(panel);
    window.__asilvaFormAssistantPanelOpen = true;

    // Focus trap
    function trapFocus(e) {
      const focusables = panel.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      if (e.key === 'Escape') { panel.remove(); window.__asilvaFormAssistantPanelOpen = false; }
    }
    panel.addEventListener('keydown', trapFocus);

    return { panel, listWrap, counter, fillAllBtn, undoBtn, clearBtn, filterInput, toast };
  }

  function showToast(toastEl, msg, type) {
    const colors = { success: '#0f7d51', error: '#c62828', warning: '#8a6d00', info: '#0069a8' };
    const bg = { success: 'rgba(15,125,81,.1)', error: 'rgba(198,40,40,.1)', warning: 'rgba(138,109,0,.1)', info: 'rgba(0,105,168,.1)' };
    toastEl.textContent = msg;
    toastEl.style.color = colors[type] || colors.info;
    toastEl.style.background = bg[type] || bg.info;
    toastEl.style.border = '1px solid ' + (colors[type] || colors.info);
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2800);
  }

  function renderFieldRow(mapping, ui, index) {
    const row = document.createElement('div');
    row.className = 'asilva-fa-row';
    row.dataset.index = index;
    row.dataset.search = (mapping.field.label + ' ' + mapping.rule.key).toLowerCase();
    row.style.cssText = 'margin-bottom:8px;padding:10px 12px;border-radius:10px;background:#f8f9fb;border:1px solid #e9ecf7;transition:.2s;';

    const validation = validateAndFormat(mapping);
    const isLong = validation.value.length > 100;
    const confColor = getConfidenceColor(mapping.confidence);

    let html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-family:Roboto Condensed,system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0069a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(mapping.field.label || mapping.field.name || mapping.field.id || 'Field') + '</div>';
    html += '<div style="font-size:10px;color:#888;margin-top:2px;">&lt;' + escapeHtml(mapping.field.tag) + (mapping.field.type !== mapping.field.tag ? ' type=' + mapping.field.type : '') + '&gt; · ' + getConfidenceLabel(mapping.confidence) + ' match</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">';
    if (mapping.sensitive) {
      html += '<span title="Sensitive field — requires confirmation" style="font-size:10px;padding:2px 6px;border-radius:999px;background:rgba(198,40,40,.1);color:#c62828;font-weight:700;">SENSITIVE</span>';
    }
    html += '<span style="font-size:10px;padding:2px 6px;border-radius:999px;background:' + confColor + '15;color:' + confColor + ';font-weight:700;">' + Math.round(mapping.confidence * 100) + '%</span>';
    html += '<button data-idx="' + index + '" class="asilva-fa-fillone" style="padding:4px 10px;border-radius:999px;border:none;background:linear-gradient(135deg,#0057c2,#0069a8);color:#fff;font-family:Montserrat,system-ui,sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">Fill</button>';
    html += '</div>';
    html += '</div>';

    html += '<div style="font-size:12px;color:#2b3350;background:#fff;padding:8px 10px;border-radius:6px;border:1px solid #e9ecf7;max-height:' + (isLong ? '90px' : 'auto') + ';overflow-y:auto;word-break:break-word;">' + escapeHtml(validation.value.substring(0, 250)) + (validation.value.length > 250 ? '…' : '') + '</div>';

    if (validation.warnings.length > 0) {
      html += '<div style="margin-top:6px;font-size:11px;color:#8a6d00;background:rgba(255,215,0,.08);padding:5px 8px;border-radius:6px;border-left:3px solid #8a6d00;">';
      html += '<strong>Warning:</strong> ' + escapeHtml(validation.warnings.join('; '));
      html += '</div>';
    }

    row.innerHTML = html;

    const fillOneBtn = row.querySelector('.asilva-fa-fillone');
    fillOneBtn.onclick = () => {
      if (mapping.sensitive) {
        if (!confirm('This field is flagged as sensitive (' + (mapping.field.label || mapping.rule.key) + '). Fill it anyway?')) return;
      }
      const v = validateAndFormat(mapping).value;
      const oldValue = mapping.field.element.value;
      mapping.field.element.value = v;
      mapping.field.element.dispatchEvent(new Event('input', { bubbles: true }));
      mapping.field.element.dispatchEvent(new Event('change', { bubbles: true }));
      mapping.field.element.style.borderColor = '#0f7d51';
      mapping.field.element.style.boxShadow = '0 0 0 3px rgba(15,125,81,.18)';
      History.push([{ element: mapping.field.element, oldValue }]);
      fillOneBtn.textContent = 'Filled';
      fillOneBtn.style.background = '#0f7d51';
      filledCount++;
      ui.counter.textContent = filledCount + ' of ' + totalCount + ' filled — review every field before submitting.';
      showToast(ui.toast, 'Field filled: ' + (mapping.field.label || mapping.rule.key), 'success');
      mapping.field.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    return row;
  }

  /* ================================================================
     9. MAIN CONTROLLER
     ================================================================ */
  function init() {
    const fields = detectFields();
    allMappings = mapFields(fields);
    totalCount = allMappings.length;
    filledCount = 0;

    const ui = createPanel();

    if (totalCount === 0) {
      ui.listWrap.innerHTML = '<div style="text-align:center;padding:24px 16px;color:#666;"><div style="font-size:32px;margin-bottom:8px;">🔍</div><strong>No recognizable form fields found</strong><br><br>This tool matches fields by label text, name, id, and placeholder. Try scrolling to the form first, or fill fields manually using the profile data below.<br><br><div style="text-align:left;background:#f8f9fb;padding:12px;border-radius:8px;font-size:12px;margin-top:12px;"><strong>Available data:</strong><br>Name, Email, Phone, LinkedIn, Degrees, Certifications, Years of Experience, Summary, Skills, Disciplines, Projects, Publications, Institutions, Cover Letter, Salary, Start Date, References, Funding Designed, Households Reached</div></div>';
      ui.counter.textContent = '0 fields detected';
      ui.fillAllBtn.disabled = true;
      ui.fillAllBtn.style.opacity = '0.5';
      ui.undoBtn.disabled = true;
      ui.undoBtn.style.opacity = '0.5';
      ui.clearBtn.disabled = true;
      ui.clearBtn.style.opacity = '0.5';
    } else {
      ui.counter.textContent = '0 of ' + totalCount + ' filled — review every field before submitting.';
      allMappings.forEach((m, i) => ui.listWrap.appendChild(renderFieldRow(m, ui, i)));

      // Filter
      ui.filterInput.addEventListener('input', () => {
        const q = ui.filterInput.value.toLowerCase();
        $$('.asilva-fa-row', ui.listWrap).forEach(row => {
          row.style.display = row.dataset.search.includes(q) ? '' : 'none';
        });
      });

      // Fill All
      ui.fillAllBtn.onclick = () => {
        let filled = 0;
        const changes = [];
        const sensitiveSkipped = [];
        allMappings.forEach((m, i) => {
          if (m.sensitive) {
            sensitiveSkipped.push(m.field.label || m.rule.key);
            return;
          }
          const v = validateAndFormat(m).value;
          const oldValue = m.field.element.value;
          m.field.element.value = v;
          m.field.element.dispatchEvent(new Event('input', { bubbles: true }));
          m.field.element.dispatchEvent(new Event('change', { bubbles: true }));
          m.field.element.style.borderColor = '#0f7d51';
          changes.push({ element: m.field.element, oldValue });
          const btn = ui.listWrap.querySelector('[data-idx="' + i + '"]');
          if (btn) { btn.textContent = 'Filled'; btn.style.background = '#0f7d51'; }
          filled++;
        });
        if (changes.length > 0) {
          History.push(changes);
          filledCount += filled;
          ui.counter.textContent = filledCount + ' of ' + totalCount + ' filled — review every field before submitting.';
          let msg = filled + ' field' + (filled > 1 ? 's' : '') + ' filled';
          if (sensitiveSkipped.length > 0) msg += ' (' + sensitiveSkipped.length + ' sensitive skipped)';
          showToast(ui.toast, msg, 'success');
        } else if (sensitiveSkipped.length > 0) {
          showToast(ui.toast, 'All fields are sensitive — fill individually', 'warning');
        }
      };

      // Undo
      ui.undoBtn.onclick = () => {
        if (History.undo()) {
          filledCount = Math.max(0, filledCount - 1);
          ui.counter.textContent = filledCount + ' of ' + totalCount + ' filled — review every field before submitting.';
          $$('.asilva-fa-fillone', ui.listWrap).forEach(btn => {
            if (btn.style.background === 'rgb(15, 125, 81)') { btn.textContent = 'Fill'; btn.style.background = 'linear-gradient(135deg, #0057c2, #0069a8)'; }
          });
          showToast(ui.toast, 'Undo successful', 'info');
        } else {
          showToast(ui.toast, 'Nothing to undo', 'warning');
        }
      };

      // Clear
      ui.clearBtn.onclick = () => {
        if (!confirm('Clear all values that were filled by the assistant?')) return;
        allMappings.forEach((m, i) => {
          m.field.element.value = '';
          m.field.element.dispatchEvent(new Event('input', { bubbles: true }));
          m.field.element.style.borderColor = '';
          m.field.element.style.boxShadow = '';
          const btn = ui.listWrap.querySelector('[data-idx="' + i + '"]');
          if (btn) { btn.textContent = 'Fill'; btn.style.background = 'linear-gradient(135deg, #0057c2, #0069a8)'; }
        });
        History.stack = [];
        filledCount = 0;
        ui.counter.textContent = '0 of ' + totalCount + ' filled — review every field before submitting.';
        showToast(ui.toast, 'All fields cleared', 'info');
      };
    }

    setTimeout(() => ui.filterInput.focus(), 100);
  }

  // Expose init so background.js can trigger it on first injection
  window.__asilvaFormAssistantInit = init;

  // Auto-init on first injection (background.js injects this file)
  init();
})();
