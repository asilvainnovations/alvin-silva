/* Career Intelligence enhancement layer
 * Integrates with the existing Career Automation page without replacing
 * the shared PWA shell. Reads the canonical root credentials.json.
 * Version: 2.0.0
 */
(() => {
  'use strict';

  const TRACKER_KEY = 'as-career-tracker';
  const MODEL_VERSION = 'career-fit-2.0.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[ch]);
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const norm = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const unique = values => [...new Set(values.filter(Boolean))];
  let credentials = null;
  let current = null;

  const WEIGHTS = {
    qualifications: 15,
    competencies: 20,
    relevantExperience: 15,
    projectEvidence: 20,
    leadership: 10,
    sectorContext: 10,
    geographicExperience: 5,
    careerDirection: 5
  };

  const ROLE_TERMS = [
    'chief','director','senior','lead','head','principal','advisor','adviser',
    'consultant','manager','specialist','officer','coordinator','analyst'
  ];
  const SECTORS = {
    government: ['government','ministry','department','agency','bureau','public sector','local government','lgu','policy'],
    humanitarian: ['humanitarian','relief','emergency response','ngo','non-government','civil society','development organization'],
    private: ['private sector','corporate','company','enterprise','business','consulting firm','startup'],
    academic: ['university','college','academic','research institute','professor','lecturer','fellow']
  };

  function parseDeadline(text) {
    const patterns = [
      /(?:deadline|closing date|apply by|submit by|applications close|closing on)\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
      /(?:deadline|closing date|apply by|submit by|applications close|closing on)\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /(?:deadline|closing date|apply by|submit by|applications close|closing on)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const raw = match[1];
        let date = null;
        if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(raw)) {
          const parts = raw.split(/[\/.-]/).map(Number);
          let [a,b,y] = parts;
          if (y < 100) y += y < 50 ? 2000 : 1900;
          // Ambiguous numeric dates default to month/day only when first > 12.
          date = a > 12 ? new Date(y, b - 1, a) : new Date(y, a - 1, b);
        } else date = new Date(raw);
        if (date && !Number.isNaN(date.getTime())) return { raw, iso: date.toISOString().slice(0,10) };
      }
    }
    return { raw: '', iso: '' };
  }

  function extractJob(text) {
    const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
    const first = lines[0] || '';
    const roleMatch = text.match(/(?:position|job title|role|vacancy|title)\s*[:\-]\s*([^\n\r]+)/i)
      || text.match(/(?:seeking|recruiting|hiring)\s+(?:a|an)?\s*([^\n\r]+)/i)
      || text.match(/^(?:senior|lead|chief|director|manager|advisor|adviser|specialist|consultant|officer|coordinator|analyst)[^\n\r]{3,100}/im);
    const role = clean(roleMatch ? (roleMatch[1] || roleMatch[0]) : '');
    const orgMatch = text.match(/(?:organization|organisation|employer|company|institution)\s*[:\-]\s*([^\n\r]+)/i)
      || text.match(/\b(?:at|with)\s+([A-Z][A-Za-z0-9&.,' -]{2,65})/);
    const organization = clean(orgMatch ? orgMatch[1] : '');
    const locMatch = text.match(/(?:duty station|location|based in|work location)\s*[:\-]\s*([^\n\r]+)/i);
    const location = clean(locMatch ? locMatch[1] : '');
    const deadline = parseDeadline(text);
    const expMatch = text.match(/(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:relevant\s+)?experience/i);
    const requiredYears = expMatch ? Number(expMatch[1]) : 0;

    const lower = text.toLowerCase();
    const sectorScores = Object.entries(SECTORS).map(([sector, terms]) => ({
      sector, score: terms.reduce((n, term) => n + (lower.includes(term) ? 1 : 0), 0)
    })).sort((a,b) => b.score-a.score);
    const sector = sectorScores[0]?.score ? sectorScores[0].sector : 'unspecified';

    const mandatorySection = (text.match(/(?:minimum|required qualifications|must have|essential criteria|mandatory requirements)([\s\S]{0,1800})/i) || [,''])[1];
    const preferredSection = (text.match(/(?:preferred|desirable|asset|an advantage)([\s\S]{0,1200})/i) || [,''])[1];
    const degreeTerms = ['doctorate','phd','master','mba','mdm','mph','bachelor','degree'];
    const certificationTerms = ['pmp','prince2','cfa','cpa','licensed','license','certified','certification'];
    const requiredDegrees = unique(degreeTerms.filter(term => (mandatorySection || text).toLowerCase().includes(term)));
    const requiredCerts = unique(certificationTerms.filter(term => (mandatorySection || text).toLowerCase().includes(term)));
    const keywords = unique(lower.match(/[a-z][a-z0-9+#.-]{3,}/g) || [])
      .filter(word => !['with','that','this','from','will','your','have','they','their','about','work','role','team','organization'].includes(word));

    return {
      organization, role, location, sector, deadline, requiredYears,
      requiredDegrees, requiredCerts, mandatoryText: mandatorySection,
      preferredText: preferredSection, keywords, rawText: text
    };
  }

  function getAllCredentialText(creds) {
    const p = creds.profile || {};
    return [
      ...(p.degrees || []),
      ...(creds.certifications || []).filter(c => c.status !== 'expired').map(c => `${c.name} ${c.issuer || ''}`),
      ...(creds.memberships || []).map(m => `${m.name} ${m.organization}`),
      ...(creds.technical_training || []).map(t => `${t.name || ''} ${t.provider || t.issuer || ''}`),
      ...(creds.disciplines || []).map(d => d.name),
      ...(creds.projects || []).map(x => `${x.name || ''} ${x.summary || ''} ${(x.keywords || []).join(' ')}`),
      ...(creds.publications || []).map(x => `${x.title || ''} ${x.type || ''}`)
    ].join(' ').toLowerCase();
  }

  function scoreJob(job, creds) {
    const profile = creds.profile || {};
    const allText = getAllCredentialText(creds);
    const degreeText = (profile.degrees || []).join(' ').toLowerCase();
    const validCerts = (creds.certifications || []).filter(c => c.status !== 'expired');
    const certText = validCerts.map(c => `${c.name} ${c.domain || ''}`).join(' ').toLowerCase();

    let qualificationScore = 75;
    const missing = [];
    if (job.requiredDegrees.length) {
      const matched = job.requiredDegrees.some(term => degreeText.includes(term));
      qualificationScore = matched ? 100 : 35;
      if (!matched) missing.push({type:'warn', label:'Education', detail:'The posting mentions a degree requirement that was not confidently matched to the documented degrees. Verify the exact qualification and equivalency.'});
    }
    if (job.requiredCerts.length) {
      const matched = job.requiredCerts.some(term => certText.includes(term));
      qualificationScore = Math.min(qualificationScore, matched ? 95 : 45);
      if (!matched) missing.push({type:'warn', label:'Certification', detail:'A certification or licence requirement was detected, but no matching currently valid credential was identified.'});
    }

    const disciplines = creds.disciplines || [];
    const disciplineMatches = disciplines.map(d => {
      const kws = (d.keywords || []).map(norm);
      const hits = job.keywords.filter(k => kws.some(kw => kw && (kw === k || kw.includes(k) || k.includes(kw))));
      return {...d, hits: unique(hits), score: unique(hits).length};
    }).sort((a,b) => b.score-a.score);
    const bestDisciplines = disciplineMatches.filter(d => d.score > 0).slice(0,4);
    const competencyScore = Math.min(100, 35 + bestDisciplines.reduce((n,d) => n + Math.min(5,d.score)*5, 0));
    const years = bestDisciplines.length ? Math.max(...bestDisciplines.map(d => Number(d.years)||0)) : Number(profile.years_total)||0;
    let experienceScore = job.requiredYears ? Math.min(100, Math.round(years / job.requiredYears * 100)) : 70;
    if (job.requiredYears && years < job.requiredYears) missing.push({type:'warn',label:'Relevant experience',detail:`The strongest related discipline record indicates ${years} years against ${job.requiredYears} requested. Confirm the actual relevant-experience evidence before treating this as an eligibility gap.`});

    const projects = (creds.projects || []).map(project => {
      const haystack = norm([project.name, project.summary, project.description, ...(project.keywords || [])].join(' '));
      const hits = job.keywords.filter(k => haystack.includes(k));
      return {...project, hits: unique(hits), evidenceScore: unique(hits).length};
    }).sort((a,b) => b.evidenceScore-a.evidenceScore);
    const projectEvidenceScore = projects.length && projects[0].evidenceScore
      ? Math.min(100, 30 + projects.slice(0,5).reduce((n,p) => n + Math.min(4,p.evidenceScore)*5,0))
      : 25;

    const roleText = `${job.role} ${job.rawText}`.toLowerCase();
    const leadershipTerms = ['lead','director','chief','head','senior','strategic','manager','advisor','adviser','principal'];
    const leadershipDemand = leadershipTerms.some(t => roleText.includes(t));
    const leadershipScore = leadershipDemand ? (Number(profile.years_total) >= 10 ? 85 : 60) : 70;

    const sectorMap = {
      government:['government','public','policy','national','local government'],
      humanitarian:['humanitarian','relief','emergency','ngo','development'],
      private:['private','corporate','enterprise','business'],
      academic:['academic','research','university']
    };
    const disciplineSector = (creds.projects || []).map(p => p.sector).filter(Boolean);
    const sectorScore = job.sector === 'unspecified' ? 60
      : disciplineSector.includes(job.sector) ? 85
      : (sectorMap[job.sector] || []).some(t => allText.includes(t)) ? 70 : 55;

    const location = job.location.toLowerCase();
    const geoScore = !location ? 60 :
      /philippines|manila|asia|pacific|southeast asia|mindanao|visayas|luzon/.test(location) ? 85 : 60;

    const strategicTerms = ['strategic','resilience','systems','transformation','policy','climate','humanitarian','development'];
    const careerDirectionScore = strategicTerms.some(t => roleText.includes(t)) ? 85 : 65;

    const breakdown = {
      qualifications: qualificationScore,
      competencies: competencyScore,
      relevantExperience: experienceScore,
      projectEvidence: projectEvidenceScore,
      leadership: leadershipScore,
      sectorContext: sectorScore,
      geographicExperience: geoScore,
      careerDirection: careerDirectionScore
    };
    const fit = Math.round(Object.entries(WEIGHTS).reduce((sum,[key,weight]) => sum + breakdown[key]*weight/100,0));
    const totalWeight = Object.values(WEIGHTS).reduce((a,b)=>a+b,0);
    const fitScore = Math.round(Object.entries(WEIGHTS).reduce((sum,[key,weight]) => sum + breakdown[key]*weight,0)/totalWeight);

    const deadlineDate = job.deadline.iso ? new Date(`${job.deadline.iso}T23:59:59`) : null;
    const daysRemaining = deadlineDate ? Math.ceil((deadlineDate - new Date())/86400000) : null;
    const feasibility = daysRemaining === null ? 65 : daysRemaining < 0 ? 0 : daysRemaining <= 3 ? 35 : daysRemaining <= 7 ? 55 : daysRemaining <= 14 ? 75 : 90;
    const strategicValue = leadershipDemand ? 85 : careerDirectionScore;
    const confidence = Math.max(35, Math.min(95, 45 + (job.role ? 10 : 0) + (job.organization ? 10 : 0) +
      (job.requiredYears ? 10 : 0) + (job.requiredDegrees.length || job.requiredCerts.length ? 10 : 0) +
      (bestDisciplines.length ? 10 : 0)));
    const eligibility = missing.some(x => x.label === 'Education' || x.label === 'Certification') ? 'Review required' : 'No clear disqualifier detected';
    if (!job.role) missing.push({type:'warn',label:'Extraction quality',detail:'Job title was not confidently identified. Confirm the extracted role before relying on the assessment.'});
    if (!job.organization) missing.push({type:'warn',label:'Organization',detail:'Organization was not confidently identified from the supplied posting.'});
    if (!missing.length) missing.push({type:'ok',label:'Initial review',detail:'No obvious gap was detected by the rules-based assessment. This is not a final eligibility determination.'});

    return {
      fitScore, breakdown, eligibility, feasibility, strategicValue, confidence,
      daysRemaining, gaps:missing, bestDisciplines, projects:projects.slice(0,5),
      cvRecommendations:rankCVs(job,creds)
    };
  }

  function rankCVs(job, creds) {
    return (creds.cv_versions || []).map(cv => {
      const cvTerms = [...(cv.keywords || []), ...(cv.disciplines || [])].map(norm).filter(Boolean);
      const hits = job.keywords.filter(word => cvTerms.some(term => term === word || term.includes(word) || word.includes(term)));
      const sectorBonus = cv.sector_focus === job.sector ? 12 : 0;
      const score = Math.min(100, Math.round((hits.length / Math.max(1,Math.min(12,job.keywords.length))) * 75 + sectorBonus));
      return {...cv, score, matchedTerms:unique(hits).slice(0,8)};
    }).sort((a,b)=>b.score-a.score);
  }

  function generateLetter(job, result, creds) {
    const p = creds.profile || {};
    const project = result.projects.find(x => x.evidenceScore > 0);
    const discipline = result.bestDisciplines[0];
    const degrees = (p.degrees || []).slice(0,2);
    const validCerts = (creds.certifications || []).filter(c => c.status === 'valid').slice(0,3);
    const opening = `I am writing to express my interest in the ${job.role || 'advertised position'} at ${job.organization || 'your organization'}.`;
    const experience = `My professional background spans ${p.years_total || 'relevant'} years in development management and related practice areas${discipline ? `, including ${discipline.name}` : ''}.`;
    const evidence = project
      ? `A relevant example from my portfolio is ${project.name}. The documented project record should be reviewed alongside the specific responsibilities and deliverables required for this role.`
      : `My portfolio includes work across strategic planning, resilience, institutional development and systems innovation. I would be pleased to identify the most relevant examples against the role's specific requirements.`;
    const credentialLines = [...degrees, ...validCerts.map(c => `${c.name} (${c.issuer || 'issuer not listed'})`)];
    return [
      'Dear Hiring Committee,','',opening,'',experience,'',evidence,'',
      'Relevant qualifications:',
      ...(credentialLines.length ? credentialLines.map(x=>`• ${x}`) : ['• Please select the qualifications most relevant to this application.']),
      '',
      'I would welcome the opportunity to discuss how my experience and documented work could contribute to your organization’s objectives.',
      '',
      'Sincerely,','Alvin M. Silva, MDM',p.email || '',p.phone || ''
    ].filter((line,index)=>line!=='' || index===1).join('\n');
  }

  function addStyles() {
    if ($('#career-intelligence-styles')) return;
    const style = document.createElement('style');
    style.id = 'career-intelligence-styles';
    style.textContent = `
      .ci-panel{margin:1rem 0;padding:1.2rem;border:1px solid var(--line);border-radius:16px;background:var(--card);color:var(--text)}
      .ci-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:.75rem;margin:.9rem 0}
      .ci-metric{padding:.85rem;border:1px solid var(--line);border-radius:12px;background:var(--pill-bg)}
      .ci-metric strong{display:block;font:800 1.55rem var(--font-display);color:var(--sky)}
      .ci-metric span,.ci-muted{font-size:.78rem;color:var(--text-3)}
      .ci-row{display:flex;justify-content:space-between;gap:1rem;align-items:center;margin:.65rem 0;font-size:.88rem}
      .ci-track{height:8px;background:var(--pill-bg);border-radius:20px;overflow:hidden;flex:1;max-width:220px}
      .ci-fill{height:100%;background:linear-gradient(90deg,var(--blue),var(--sky));border-radius:20px}
      .ci-tag{display:inline-block;border:1px solid var(--line);border-radius:30px;padding:.2rem .55rem;font-size:.72rem;margin:.12rem}
      .ci-gap{padding:.7rem;border-left:3px solid var(--gold);background:var(--pill-bg);border-radius:6px;margin:.5rem 0;font-size:.84rem}
      .ci-gap.ok{border-color:var(--green)} .ci-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem}
      .ci-small{font-size:.76rem;color:var(--text-3)}
      .ci-table-wrap{overflow-x:auto}.ci-table{width:100%;border-collapse:collapse;font-size:.82rem}
      .ci-table th,.ci-table td{padding:.65rem;text-align:left;border-bottom:1px solid var(--divider);vertical-align:top}
      .ci-table th{font-family:var(--font-cond);text-transform:uppercase;letter-spacing:.06em;color:var(--sky)}
      .ci-table select{max-width:140px;padding:.4rem;border-radius:8px;background:var(--input-bg);color:var(--text);border:1px solid var(--line)}
      @media(max-width:640px){.ci-row{align-items:flex-start;flex-direction:column}.ci-track{max-width:none;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function renderIntelligence(job, result, letter) {
    const section = $('#results-section');
    if (!section) return;
    let panel = $('#careerIntelligenceResults');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'careerIntelligenceResults';
      panel.className = 'ci-panel';
      section.appendChild(panel);
    }
    const metrics = [
      ['Professional fit',`${result.fitScore}/100`],
      ['Application feasibility',`${result.feasibility}/100`],
      ['Career value',`${result.strategicValue}/100`],
      ['Assessment confidence',`${result.confidence}%`]
    ];
    const rows = Object.entries(result.breakdown).map(([key,value]) => `
      <div class="ci-row"><span>${escapeHtml(key.replace(/[A-Z]/g,m=>' '+m).replace(/^./,m=>m.toUpperCase()))}</span>
      <div class="ci-track"><div class="ci-fill" style="width:${value}%"></div></div><strong>${value}</strong></div>`).join('');
    const cvRows = result.cvRecommendations.slice(0,5).map(cv => `
      <tr><td><strong>${escapeHtml(cv.file)}</strong><br><span class="ci-small">${escapeHtml((cv.disciplines||[]).join(' · '))}</span></td>
      <td>${cv.score}/100</td><td>${escapeHtml(cv.matchedTerms.join(', ') || 'No strong keyword evidence')}</td>
      <td><a href="Alvin_Silva_CV_Versions/${encodeURIComponent(cv.file)}" target="_blank" rel="noopener">View CV</a></td></tr>`).join('');
    const projectTags = result.projects.filter(p=>p.evidenceScore>0).slice(0,4)
      .map(p=>`<span class="ci-tag">${escapeHtml(p.name)}</span>`).join('') || '<span class="ci-muted">No strong project keyword evidence found; review the portfolio manually.</span>';
    const gaps = result.gaps.map(g=>`<div class="ci-gap ${g.type==='ok'?'ok':''}"><strong>${escapeHtml(g.label)}:</strong> ${escapeHtml(g.detail)}</div>`).join('');
    panel.innerHTML = `
      <h3>Career intelligence assessment</h3>
      <p class="ci-muted">Rules-based assessment · ${MODEL_VERSION} · Canonical credentials source</p>
      <div class="ci-grid">${metrics.map(([label,value])=>`<div class="ci-metric"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
      <p><strong>Eligibility:</strong> ${escapeHtml(result.eligibility)}</p>
      <p><strong>Deadline:</strong> ${job.deadline.iso ? `${escapeHtml(job.deadline.raw)} (${result.daysRemaining<0?'expired':`${result.daysRemaining} days remaining`})` : 'Not detected — verify the source posting.'}</p>
      <h4>Professional fit breakdown</h4>${rows}
      <h4>Evidence gaps and validation points</h4>${gaps}
      <h4>Relevant portfolio evidence to review</h4><div>${projectTags}</div>
      <h4>Ranked CV recommendations</h4>
      <div class="ci-table-wrap"><table class="ci-table"><thead><tr><th>CV version</th><th>Match</th><th>Matched terms</th><th>File</th></tr></thead><tbody>${cvRows}</tbody></table></div>
      <p class="ci-small">Scores are decision-support estimates, not hiring probabilities or final eligibility decisions. Verify mandatory requirements and project responsibilities against source documents.</p>
      <h4>Draft cover letter (evidence-conscious)</h4>
      <textarea id="ciCoverLetter" rows="14" style="width:100%;padding:.8rem;border:1px solid var(--line);border-radius:10px;background:var(--input-bg);color:var(--text);font:inherit">${escapeHtml(letter)}</textarea>
      <div class="ci-actions"><button type="button" class="btn btn-ghost btn-sm" id="ciCopyLetter">Copy letter</button><button type="button" class="btn btn-primary btn-sm" id="ciSaveOpportunity">Save opportunity</button></div>`;
    $('#ciCopyLetter').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#ciCoverLetter').value); alert('Cover letter copied.'); }
      catch { $('#ciCoverLetter').select(); alert('Select and copy the cover letter.'); }
    });
    $('#ciSaveOpportunity').addEventListener('click', saveCurrent);
  }

  function readTracker() {
    try {
      const data = JSON.parse(localStorage.getItem(TRACKER_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }
  function writeTracker(items) {
    try { localStorage.setItem(TRACKER_KEY, JSON.stringify(items)); renderTracker(); return true; }
    catch { alert('The browser could not save this record. Export existing records and check available storage.'); return false; }
  }
  function saveCurrent() {
    if (!current) return;
    const items = readTracker();
    const key = `${norm(current.job.organization)}|${norm(current.job.role)}`;
    const duplicate = items.find(item => `${norm(item.organization)}|${norm(item.role)}` === key);
    if (duplicate) {
      if (!confirm('A similar organization and role already exists in your tracker. Save another record anyway?')) return;
    }
    const letter = $('#ciCoverLetter')?.value || current.letter;
    const record = {
      id: (crypto.randomUUID ? crypto.randomUUID() : `opp-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      organization: current.job.organization || 'Organization not identified',
      role: current.job.role || 'Role not identified',
      sector: current.job.sector,
      location: current.job.location,
      deadline: current.job.deadline.raw,
      deadlineISO: current.job.deadline.iso,
      score: current.result.fitScore,
      feasibility: current.result.feasibility,
      careerValue: current.result.strategicValue,
      confidence: current.result.confidence,
      cv: current.result.cvRecommendations[0]?.file || '',
      coverLetter: letter,
      sourceText: current.job.rawText.slice(0,12000),
      modelVersion: MODEL_VERSION,
      status: 'New',
      dateAdded: new Date().toISOString()
    };
    items.unshift(record);
    if (writeTracker(items)) alert('Opportunity saved to this browser. It is not synchronized across devices.');
  }

  function renderTracker() {
    const container = $('#trackerContent');
    if (!container) return;
    const items = readTracker();
    if (!items.length) {
      container.innerHTML = '<div class="tracker-empty"><p>No opportunities tracked yet. Analyze a posting and save it to get started.</p></div>';
      return;
    }
    const statuses = ['New','Analyzing','Applied','Interview','Offer','Rejected','Withdrawn','Ghosted'];
    const rows = items.map(item => `
      <tr data-id="${escapeHtml(item.id)}">
        <td><strong>${escapeHtml(item.organization)}</strong></td>
        <td>${escapeHtml(item.role)}</td>
        <td>${Number(item.score)||0}/100</td>
        <td>${escapeHtml(item.deadline || '—')}</td>
        <td><select class="ci-status" aria-label="Application status">${statuses.map(s=>`<option ${item.status===s?'selected':''}>${s}</option>`).join('')}</select></td>
        <td>${escapeHtml((item.dateAdded||'').slice(0,10))}</td>
        <td><button type="button" class="btn btn-ghost btn-sm ci-delete">Delete</button></td>
      </tr>`).join('');
    container.innerHTML = `<div class="ci-table-wrap"><table class="ci-table"><thead><tr><th>Organization</th><th>Role</th><th>Fit</th><th>Deadline</th><th>Status</th><th>Added</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    container.querySelectorAll('tr[data-id]').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('.ci-status').addEventListener('change', e => {
        const records = readTracker(); const record = records.find(x=>String(x.id)===String(id));
        if (record) { record.status=e.target.value; record.updatedAt=new Date().toISOString(); writeTracker(records); }
      });
      row.querySelector('.ci-delete').addEventListener('click', () => {
        if (confirm('Delete this opportunity from this browser?')) writeTracker(readTracker().filter(x=>String(x.id)!==String(id)));
      });
    });
  }

  function csvCell(value) {
    let text = String(value ?? '');
    // Prevent spreadsheet formula injection after optional whitespace/control characters.
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g,'""')}"`;
  }
  function exportTracker() {
    const items = readTracker();
    if (!items.length) { alert('There are no saved opportunities to export.'); return; }
    const headers = ['Organization','Role','Sector','Location','Deadline','Fit Score','Feasibility','Career Value','Confidence','CV','Status','Date Added','Model Version'];
    const rows = items.map(x => [x.organization,x.role,x.sector,x.location,x.deadline,x.score,x.feasibility,x.careerValue,x.confidence,x.cv,x.status,x.dateAdded,x.modelVersion].map(csvCell).join(','));
    const blob = new Blob(['\uFEFF'+[headers.map(csvCell).join(','),...rows].join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href=url; link.download=`alvin-career-opportunities-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function analyze() {
    const text = clean($('#jobInput')?.value);
    if (!text) { alert('Paste the full job description before analyzing.'); return; }
    const button = $('#analyzeBtn');
    if (button) { button.disabled=true; button.dataset.originalText=button.textContent; button.textContent='Analyzing…'; }
    try {
      if (!credentials) {
        const response = await fetch(new URL('credentials.json', document.baseURI), {cache:'no-cache'});
        if (!response.ok) throw new Error(`credentials.json returned HTTP ${response.status}`);
        credentials = await response.json();
        if (!credentials.profile || !Array.isArray(credentials.disciplines) || !Array.isArray(credentials.cv_versions)) {
          throw new Error('The canonical credentials file does not match the expected schema.');
        }
      }
      const job = extractJob(text);
      const result = scoreJob(job, credentials);
      const letter = generateLetter(job,result,credentials);
      current = {job,result,letter};
      renderIntelligence(job,result,letter);
      const results = $('#results-section');
      if (results) { results.style.display=''; results.scrollIntoView({behavior:'smooth',block:'start'}); }
    } catch (error) {
      console.error('[Career Intelligence]',error);
      alert(`Analysis could not be completed: ${error.message}. Check that credentials.json is available and valid.`);
    } finally {
      if (button) { button.disabled=false; button.textContent=button.dataset.originalText || 'Analyze Opportunity'; }
    }
  }

  function bind() {
    addStyles();
    // Capture phase prevents the legacy scorer from running in parallel with this engine.
    $('#analyzeBtn')?.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation(); analyze();
    }, true);
    $('#saveTrackerBtn')?.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation(); saveCurrent();
    }, true);
    $('#exportCsvBtn')?.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation(); exportTracker();
    }, true);
    $('#clearTrackerBtn')?.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (confirm('Clear all locally saved opportunities? Export a backup first if needed.')) {
        localStorage.removeItem(TRACKER_KEY); renderTracker();
      }
    }, true);
    renderTracker();
    // The legacy page performs one asynchronous initial render after loading
    // credentials. Re-render only if that legacy markup replaces our table.
    const tracker = $('#trackerContent');
    if (tracker && window.MutationObserver) {
      const observer = new MutationObserver(() => {
        if (!tracker.querySelector('.ci-table') && readTracker().length) renderTracker();
      });
      observer.observe(tracker, {childList:true,subtree:true});
    }
    console.info(`[Career Intelligence] ${MODEL_VERSION} initialized. Private records remain in this browser.`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
