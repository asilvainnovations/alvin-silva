javascript:(function(){
const CREDENTIALS = {
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
const FIELD_MAP = [
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
function detectFields() {
  const inputs = document.querySelectorAll('input, textarea, select');
  const detected = [];
  inputs.forEach(input => {
    const label = findLabel(input);
    const text = (label + ' ' + input.name + ' ' + input.placeholder + ' ' + input.id).toLowerCase();
    for (const mapping of FIELD_MAP) {
      if (mapping.keywords.some(k => text.includes(k))) {
        detected.push({ element: input, mapping, label: label || input.name || input.placeholder || input.id });
        break;
      }
    }
  });
  return detected;
}
function findLabel(input) {
  if (input.id) { const label = document.querySelector('label[for="' + input.id + '"]'); if (label) return label.textContent.trim(); }
  const parentLabel = input.closest('label');
  if (parentLabel) return parentLabel.textContent.trim();
  const prev = input.previousElementSibling;
  if (prev && prev.textContent) return prev.textContent.trim();
  return '';
}
function createPanel(detected) {
  const existing = document.getElementById('asilva-form-assistant');
  if (existing) existing.remove();
  const panel = document.createElement('div');
  panel.id = 'asilva-form-assistant';
  panel.style.cssText = 'position:fixed;top:80px;right:20px;width:380px;max-height:85vh;overflow-y:auto;background:#fff;border:2px solid #FFD700;border-radius:16px;padding:1.2rem;box-shadow:0 20px 60px rgba(0,0,0,.35);z-index:99999;font-family:"Poppins",system-ui,sans-serif;font-size:.9rem;line-height:1.6;color:#0d1224;';
  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding-bottom:.8rem;border-bottom:1px solid #eee"><h2 style="margin:0;font-family:Montserrat;font-size:1.1rem;font-weight:800;background:linear-gradient(45deg,#0069a8,#0057c2,#8a6d00);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">ASilva Form Assistant</h2><button onclick="this.closest(\'#asilva-form-assistant\').remove()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#999;line-height:1">&times;</button></div>';
  if (detected.length === 0) {
    html += '<p style="color:#666;text-align:center;padding:1rem">No recognizable form fields found.<br><br>This tool detects fields by label text. If the form uses non-standard labels, copy-paste manually.</p>';
    panel.innerHTML = html; document.body.appendChild(panel); return;
  }
  html += '<p style="font-size:.78rem;color:#666;margin-bottom:1rem">Detected <strong>' + detected.length + '</strong> fields. Click "Fill" to populate. Review before submitting.</p>';
  detected.forEach((d, i) => {
    const value = CREDENTIALS[d.mapping.key];
    const isLong = value.length > 80;
    html += '<div style="margin-bottom:.9rem;padding:.7rem;border-radius:10px;background:#f8f9fb;border:1px solid #e9ecf7"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.4rem"><div style="font-family:Roboto Condensed;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0069a8">' + (d.label || d.mapping.key) + '</div><button data-index="' + i + '" class="asilva-fill-btn" style="padding:.3rem .7rem;border-radius:999px;border:none;background:linear-gradient(135deg,#0057c2,#0069a8);color:#fff;font-family:Montserrat;font-size:.72rem;font-weight:700;cursor:pointer;white-space:nowrap">Fill Field</button></div><div class="asilva-preview" style="font-size:.82rem;color:#2b3350;background:#fff;padding:.5rem .7rem;border-radius:6px;border:1px solid #e9ecf7;max-height:' + (isLong ? '100px' : 'auto') + ';overflow-y:auto;word-break:break-word">' + value.substring(0, 200) + (value.length > 200 ? '...' : '') + '</div></div>';
  });
  html += '<div style="margin-top:1rem;padding-top:.8rem;border-top:1px solid #eee;display:flex;gap:.5rem"><button id="asilva-fill-all" style="flex:1;padding:.6rem;border-radius:999px;border:none;background:linear-gradient(135deg,#0057c2,#0069a8);color:#fff;font-family:Montserrat;font-weight:700;font-size:.85rem;cursor:pointer">Fill All Fields</button><button id="asilva-clear-all" style="padding:.6rem 1rem;border-radius:999px;border:1px solid #ddd;background:#fff;color:#666;font-family:Montserrat;font-weight:700;font-size:.85rem;cursor:pointer">Clear</button></div><p style="font-size:.7rem;color:#999;text-align:center;margin-top:.8rem">Review all fields before submitting.</p>';
  panel.innerHTML = html; document.body.appendChild(panel);
  panel.querySelectorAll('.asilva-fill-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const d = detected[idx];
      d.element.value = CREDENTIALS[d.mapping.key];
      d.element.dispatchEvent(new Event('input', { bubbles: true }));
      d.element.dispatchEvent(new Event('change', { bubbles: true }));
      btn.textContent = 'Filled'; btn.style.background = '#0f7d51';
      d.element.style.borderColor = '#0f7d51'; d.element.style.boxShadow = '0 0 0 3px rgba(15,125,81,.2)';
    });
  });
  panel.querySelector('#asilva-fill-all').addEventListener('click', () => {
    detected.forEach((d, i) => {
      d.element.value = CREDENTIALS[d.mapping.key];
      d.element.dispatchEvent(new Event('input', { bubbles: true }));
      d.element.dispatchEvent(new Event('change', { bubbles: true }));
      const btn = panel.querySelector('[data-index="' + i + '"]');
      if (btn) { btn.textContent = 'Filled'; btn.style.background = '#0f7d51'; }
      d.element.style.borderColor = '#0f7d51';
    });
  });
  panel.querySelector('#asilva-clear-all').addEventListener('click', () => {
    detected.forEach(d => { d.element.value = ''; d.element.dispatchEvent(new Event('input', { bubbles: true })); d.element.style.borderColor = ''; d.element.style.boxShadow = ''; });
    panel.querySelectorAll('.asilva-fill-btn').forEach(btn => { btn.textContent = 'Fill Field'; btn.style.background = 'linear-gradient(135deg,#0057c2,#0069a8)'; });
  });
}
const detected = detectFields();
createPanel(detected);
if (detected.length > 0) detected[0].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
})();
