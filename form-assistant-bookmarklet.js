javascript:(function(){
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str == null ? '' : String(str); return div.innerHTML; }
var CREDENTIALS = {
  name: "Alvin M. Silva, MDM",
  email: "alvin.silva@asilvainnovations.com",
  phone: "+63 917 855 5134",
  linkedin: "https://alvin-silva-linkedin.asilvainnovations.com",
  degrees: "MDM — Master in Development Management, Asian Institute of Management",
  certifications: "Certified SRMP, Certified International Humanitarian Practitioner, Certified DRR Practitioner",
  years: "18+",
  countries: "15",
  funding: "190M",
  households: "50,000+",
  completion: "100%",
  summary: "Development Management Professional & Resilience Consultant with 18+ years across 15 countries. Architect of BIRD 2026-2035, DDRiVE-M, and Strat Planner Pro. Published author. MDM, AIM.",
  skills: "Strategic Planning, Climate Change Adaptation, Disaster Risk Reduction, Systems Innovation, Organizational Development, Capacity Building, Security Risk Management, M&E, Policy Research, Project Management",
  publications: "Personal Resilience: The Path to Oneness (2025); Resilient Futures: Nurturing Oneness in Education (2024); Building Resilience: The Path to a More Fulfilling Life (2023)",
  references: "Available upon request",
  salary: "Negotiable based on role scope and organizational mandate",
  start_date: "Immediately available for strategic roles aligned with resilience and systems innovation",
  why_hire: "I bring a systems-level perspective grounded in measurable outcomes — 190M in climate-smart funding designed, 50,000+ households reached, 100% project completion rate. My decade-scale roadmaps (BIRD 2026-2035, TESDA Strategic Plan) demonstrate the ability to align institutional vision with executable frameworks."
};
var FIELD_MAP = [
  { keywords: ['name','full name','applicant name'], key: 'name' },
  { keywords: ['email','e-mail','contact email'], key: 'email' },
  { keywords: ['phone','mobile','contact number','telephone'], key: 'phone' },
  { keywords: ['linkedin','linked in','profile url'], key: 'linkedin' },
  { keywords: ['degree','education','qualification','academic'], key: 'degrees' },
  { keywords: ['certification','license','credential'], key: 'certifications' },
  { keywords: ['experience','years','professional experience'], key: 'years' },
  { keywords: ['summary','profile','about','bio','overview','personal statement'], key: 'summary' },
  { keywords: ['skill','competency','expertise','technical skill'], key: 'skills' },
  { keywords: ['publication','book','paper','research'], key: 'publications' },
  { keywords: ['reference','referee'], key: 'references' },
  { keywords: ['salary','compensation','expected salary','pay'], key: 'salary' },
  { keywords: ['start','availability','notice','when can you start'], key: 'start_date' },
  { keywords: ['why','motivation','cover letter','statement of purpose','why hire','why you'], key: 'why_hire' },
  { keywords: ['achievement','accomplishment','impact','result'], key: 'completion' },
  { keywords: ['funding','budget','grant','financial'], key: 'funding' }
];
function findLabel(input) {
  if (input.id) { var label = document.querySelector('label[for="' + input.id + '"]'); if (label) return label.textContent.trim(); }
  var parentLabel = input.closest('label');
  if (parentLabel) return parentLabel.textContent.trim();
  var prev = input.previousElementSibling;
  if (prev && prev.textContent) return prev.textContent.trim();
  return '';
}
function detectFields() {
  var inputs = document.querySelectorAll('input, textarea, select');
  var detected = [];
  inputs.forEach(function(input) {
    var type = (input.getAttribute('type') || '').toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'checkbox' || type === 'radio' || type === 'file' || input.disabled || input.readOnly) return;
    var label = findLabel(input);
    var text = (label + ' ' + (input.name || '') + ' ' + (input.placeholder || '') + ' ' + (input.id || '')).toLowerCase();
    for (var m = 0; m < FIELD_MAP.length; m++) {
      var mapping = FIELD_MAP[m];
      if (mapping.keywords.some(function(k) { return text.indexOf(k) !== -1; })) {
        if (CREDENTIALS[mapping.key] === undefined) break;
        detected.push({ element: input, mapping: mapping, label: label || input.name || input.placeholder || input.id || mapping.key });
        break;
      }
    }
  });
  return detected;
}
function updateCounter(panel, filledCount, total) {
  var counter = panel.querySelector('#asilva-counter');
  if (counter) counter.textContent = filledCount + ' of ' + total + ' filled';
}
function createPanel(detected) {
  var existing = document.getElementById('asilva-form-assistant');
  if (existing) existing.remove();
  var panel = document.createElement('div');
  panel.id = 'asilva-form-assistant';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'ASilva Form Assistant');
  panel.style.cssText = 'position:fixed;top:80px;right:20px;width:380px;max-height:85vh;overflow-y:auto;background:#fff;border:2px solid #FFD700;border-radius:16px;padding:1.2rem;box-shadow:0 20px 60px rgba(0,0,0,.35);z-index:2147483647;font-family:"Poppins",system-ui,sans-serif;font-size:.9rem;line-height:1.6;color:#0d1224;';
  var filledCount = 0;
  var html = '';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;padding-bottom:.8rem;border-bottom:1px solid #eee">';
  html += '<h2 style="margin:0;font-family:Montserrat,system-ui,sans-serif;font-size:1.1rem;font-weight:800;background:linear-gradient(45deg,#0069a8,#0057c2,#8a6d00);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">ASilva Form Assistant</h2>';
  html += '<button id="asilva-close" aria-label="Close panel" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#999;line-height:1;padding:.2rem .4rem">&times;</button>';
  html += '</div>';
  if (detected.length === 0) {
    html += '<p style="color:#666;text-align:center;padding:1rem">No recognizable form fields found on this page.<br><br>This tool matches fields by their visible label text, so unusual or icon-only labels may be missed — copy from the fields below manually if needed.</p>';
    panel.innerHTML = html;
    document.body.appendChild(panel);
    document.getElementById('asilva-close').addEventListener('click', function() { panel.remove(); });
    return;
  }
  html += '<div id="asilva-counter" style="font-size:.78rem;color:#666;margin-bottom:1rem">0 of ' + detected.length + ' filled — review every field before you submit.</div>';
  detected.forEach(function(d, i) {
    var value = CREDENTIALS[d.mapping.key] || '';
    var isLong = value.length > 80;
    html += '<div style="margin-bottom:.9rem;padding:.7rem;border-radius:10px;background:#f8f9fb;border:1px solid #e9ecf7">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.4rem">';
    html += '<div style="font-family:Roboto Condensed,system-ui,sans-serif;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0069a8">' + escapeHtml(d.label || d.mapping.key) + '</div>';
    html += '<button data-index="' + i + '" class="asilva-fill-btn" style="padding:.3rem .7rem;border-radius:999px;border:none;background:linear-gradient(135deg,#0057c2,#0069a8);color:#fff;font-family:Montserrat,system-ui,sans-serif;font-size:.72rem;font-weight:700;cursor:pointer;white-space:nowrap">Fill Field</button>';
    html += '</div>';
    html += '<div class="asilva-preview" style="font-size:.82rem;color:#2b3350;background:#fff;padding:.5rem .7rem;border-radius:6px;border:1px solid #e9ecf7;max-height:' + (isLong ? '100px' : 'auto') + ';overflow-y:auto;word-break:break-word">' + escapeHtml(value.substring(0, 200)) + (value.length > 200 ? '...' : '') + '</div>';
    html += '</div>';
  });
  html += '<div style="margin-top:1rem;padding-top:.8rem;border-top:1px solid #eee;display:flex;gap:.5rem">';
  html += '<button id="asilva-fill-all" style="flex:1;padding:.6rem;border-radius:999px;border:none;background:linear-gradient(135deg,#0057c2,#0069a8);color:#fff;font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:.85rem;cursor:pointer">Fill All Fields</button>';
  html += '<button id="asilva-clear-all" style="padding:.6rem 1rem;border-radius:999px;border:1px solid #ddd;background:#fff;color:#666;font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:.85rem;cursor:pointer">Clear</button>';
  html += '</div>';
  html += '<p style="font-size:.7rem;color:#999;text-align:center;margin-top:.8rem">This only fills fields for your review — it never submits anything. Press Esc to close.</p>';
  panel.innerHTML = html;
  document.body.appendChild(panel);
  document.getElementById('asilva-close').addEventListener('click', function() { panel.remove(); });
  function markFilled(idx) {
    var btn = panel.querySelector('[data-index="' + idx + '"]');
    if (btn && btn.textContent !== 'Filled') { btn.textContent = 'Filled'; btn.style.background = '#0f7d51'; filledCount++; updateCounter(panel, filledCount, detected.length); }
  }
  panel.querySelectorAll('.asilva-fill-btn').forEach(function(btn, idx) {
    btn.addEventListener('click', function() {
      var d = detected[idx];
      var val = CREDENTIALS[d.mapping.key];
      if (val === undefined) return;
      d.element.value = val;
      d.element.dispatchEvent(new Event('input', { bubbles: true }));
      d.element.dispatchEvent(new Event('change', { bubbles: true }));
      markFilled(idx);
      d.element.style.borderColor = '#0f7d51';
      d.element.style.boxShadow = '0 0 0 3px rgba(15,125,81,.2)';
      d.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
  var fillAllBtn = panel.querySelector('#asilva-fill-all');
  if (fillAllBtn) fillAllBtn.addEventListener('click', function() {
    detected.forEach(function(d, i) {
      var val = CREDENTIALS[d.mapping.key];
      if (val === undefined) return;
      d.element.value = val;
      d.element.dispatchEvent(new Event('input', { bubbles: true }));
      d.element.dispatchEvent(new Event('change', { bubbles: true }));
      markFilled(i);
      d.element.style.borderColor = '#0f7d51';
    });
  });
  var clearAllBtn = panel.querySelector('#asilva-clear-all');
  if (clearAllBtn) clearAllBtn.addEventListener('click', function() {
    detected.forEach(function(d) { d.element.value = ''; d.element.dispatchEvent(new Event('input', { bubbles: true })); d.element.style.borderColor = ''; d.element.style.boxShadow = ''; });
    panel.querySelectorAll('.asilva-fill-btn').forEach(function(btn) { btn.textContent = 'Fill Field'; btn.style.background = 'linear-gradient(135deg,#0057c2,#0069a8)'; });
    filledCount = 0;
    updateCounter(panel, filledCount, detected.length);
  });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { panel.remove(); document.removeEventListener('keydown', escHandler); }
  });
}
var detected = detectFields();
createPanel(detected);
if (detected.length > 0) detected[0].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
})();
