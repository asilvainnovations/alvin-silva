#!/usr/bin/env node
/**
 * test-career-engine.mjs — evaluation suite for the CIOMS job-intelligence
 * engine (assets/js/modules/career-engine.js) against the canonical
 * credentials.json.
 *
 *   node scripts/test-career-engine.mjs            # run all checks (CI)
 *   node scripts/test-career-engine.mjs --report   # also print a score table
 *
 * The postings below are SYNTHETIC reference fixtures for the eight test
 * scenarios in the 2026 architecture review. Assertions are on expected
 * behavior (ranking, classification, eligibility, separation of scores),
 * not on exact numbers, so weights can be recalibrated without rewriting
 * the suite. Expected values reflect an expert reading of each fixture.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const E = require(join(ROOT, 'assets/js/modules/career-engine.js'));
const CREDS = JSON.parse(readFileSync(join(ROOT, 'credentials.json'), 'utf8'));
const TODAY = new Date('2026-11-02T00:00:00Z');
const REPORT = process.argv.includes('--report');

const FIXTURES = {
  drr: `Position Title: Senior Disaster Risk Reduction Adviser
Organization: United Nations Development Programme (UNDP)
Duty Station: Manila, Philippines
Contract type: Fixed-term, 12 months

Background
UNDP supports national and local governments to strengthen disaster resilience.

Key Responsibilities
- Provide technical advice on disaster risk reduction and management policy aligned with RA 10121 and the Sendai Framework.
- Support LGUs in contingency planning, early warning and Emergency Operations Center protocols.
- Coordinate with national agencies, LGUs and development partners.
- Develop capacity building programmes for DRRM offices.

Required Qualifications
- Master's degree in development studies, public administration, disaster management or related field.
- Minimum of ten (10) years of progressively responsible experience in disaster risk reduction.
- Excellent written English.

Desirable
- Experience with business continuity planning (ISO 22301) is an advantage.

How to Apply
Submit a CV and cover letter. Deadline for applications: 30 November 2026.`,

  climate: `Climate Resilience Specialist
Plan International Philippines is seeking a Climate Resilience Specialist for its climate change adaptation portfolio in Eastern Visayas.
Location: Tacloban, Leyte

Responsibilities
• Lead climate risk assessments and community-based adaptation planning.
• Develop funder-ready proposals for climate finance (e.g., People's Survival Fund, GCF).
• Support monitoring of adaptation outcomes.

Qualifications
• Bachelor's degree in environmental science, development or related field; Master's preferred.
• At least 7 years experience in climate change adaptation or DRR.
Applications close on December 15, 2026.`,

  strategy: `Director, Strategic Planning Office
Department of Trade and Industry (Government of the Philippines)
Location: Makati City
Position: Director IV (Salary Grade 28), Plantilla

Duties and Responsibilities
- Lead the formulation of the agency's medium-term strategic plan and investment roadmap.
- Supervise a team of planning officers and oversee performance management.
- Advise the Secretary on policy and strategic direction.

Qualification Standards
- Master's degree in public administration, economics, management or related field.
- Five (5) years of supervisory experience in planning.
- Career Service Executive Eligibility (CSEE) or Career Executive Service (CES) eligibility required.

Submit the Personal Data Sheet (CS Form 212), CV and transcript of records on or before November 20, 2026.`,

  humanitarian: `International Humanitarian Security Adviser
Organization: International NGO Safety Organisation
Duty Station: Cox's Bazar, Bangladesh (relocation required)

Responsibilities
- Lead security risk management for humanitarian operations, including security plans and duty of care.
- Coordinate with UN agencies and humanitarian clusters.

Requirements
- Advanced university degree (Master's) in a relevant field.
- Valid SRMP certification required.
- Minimum 8 years of humanitarian security experience.
- Fluency in English and French is mandatory.
Closing date: 2026-11-08`,

  mel: `Monitoring, Evaluation and Learning (MEL) Specialist
USAID-funded resilience programme in BARMM — Cotabato City
Responsibilities
- Design the results framework, logframe and indicators; manage baseline and endline studies.
- Lead evaluation design and learning agenda; ensure data quality and dashboards.
Qualifications
- Master's degree in social sciences, statistics or related field.
- Minimum of 6 years experience in monitoring and evaluation of development programmes.
- Experience with Power BI dashboards is an advantage.
Deadline: 12/15/2026`,

  digital: `Digital Transformation Adviser (Consultant, 6 months)
Organization: Asian Development Bank
Location: Home-based with travel to Manila
Scope of Work
- Advise government agencies on digital transformation strategy and data management.
- Design data platforms, dashboards and automation using low-code tools.
- Facilitate capacity building on data analytics.
Qualifications
- Bachelor's degree in information technology, management or related field; Master's preferred.
- At least 8 years of experience in digital transformation or information management.
Submit technical proposal and financial proposal by 25 November 2026.`,

  policy: `Senior Policy Consultant — Local Governance Reform
The Asia Foundation is seeking a Senior Policy Consultant.
Location: Quezon City, Philippines
Tasks
- Conduct policy research and political economy analysis on local governance.
- Draft policy briefs and support legislation for inclusive governance.
- Facilitate multi-stakeholder consultations.
Requirements
- Master's degree in political science, public policy or related field.
- 10 years of experience in policy analysis and governance.
- Strong writing skills; publications are an advantage.
Deadline: November 28, 2026`,

  /* Negative controls: roles outside the documented profile. */
  nurse: `Staff Nurse (ICU)
St. Luke's Medical Center — Taguig City
Responsibilities
- Provide direct patient care in the intensive care unit, administer medications and monitor vital signs.
- Maintain accurate nursing records.
Qualifications
- Bachelor of Science in Nursing is required.
- Valid PRC Nursing License is mandatory.
- At least 2 years of ICU experience.
Deadline: November 30, 2026`,

  backend: `Senior Backend Engineer (Java)
Fintech startup, Singapore (on-site only)
Responsibilities
- Build Java/Spring Boot microservices on Kubernetes; own CI/CD pipelines and observability.
- Optimize PostgreSQL queries and Kafka event streams.
Requirements
- Bachelor's degree in computer science is required.
- 7+ years of professional Java backend experience.
- Deep experience with Kubernetes, Kafka and distributed systems.
Apply by 2026-12-10.`,

  research: `Research Fellow, Disaster Resilience Studies
University of the Philippines — Resilience Institute
Responsibilities
- Lead peer-reviewed research on community resilience and disaster risk.
- Publish in academic journals and supervise research assistants.
Minimum Qualifications
- PhD in social sciences, environmental studies or a related field is required.
- At least 3 years of post-doctoral research experience.
Apply by 2026-12-31.`
};

const ev = E.buildEvidenceIndex(CREDS, { today: TODAY });
const results = {};
for (const [k, txt] of Object.entries(FIXTURES)) {
  const job = E.extractJob(txt, { today: TODAY, institutions: CREDS.institutions });
  results[k] = { job, r: E.assess(job, CREDS, { today: TODAY, evidence: ev }) };
}
const cvRank = (k, file) => results[k].r.cvs.findIndex((c) => c.file === file);
const topComp = (k, n = 4) => results[k].r.competencies.slice(0, n).map((c) => c.id);

test('evidence index: expired SRMP-C is not counted as current', () => {
  const srmp = ev.items.find((i) => /SRMP-C/.test(i.title));
  assert.equal(srmp.status, 'expired');
  assert.ok(!ev.byCompetency.security.includes(srmp.id), 'expired cert must not add strength');
});

test('evidence index: all canonical collections are represented', () => {
  const kinds = new Set(ev.items.map((i) => i.kind));
  ['discipline', 'project', 'certification', 'membership', 'appointment', 'training', 'publication', 'degree'].forEach((k) => assert.ok(kinds.has(k), k));
  assert.equal(ev.items.filter((i) => i.kind === 'discipline').length, CREDS.disciplines.length);
  assert.equal(ev.items.filter((i) => i.kind === 'project').length, CREDS.projects.length);
});

test('extraction: title, organization, deadline, years, mandatory vs preferred', () => {
  const j = results.drr.job;
  assert.match(j.fields.title.value, /Senior Disaster Risk Reduction Adviser/);
  assert.match(j.fields.organization.value, /UNDP/);
  assert.equal(j.fields.deadline.value, '2026-11-30');
  assert.equal(j.fields.requiredYears.value, 10, 'word-number "ten (10)" is parsed');
  assert.equal(j.fields.degreeLevel.value, 2);
  const iso = j.requirements.find((r) => /ISO 22301/.test(r.text));
  assert.equal(iso.priority, 'preferred');
  const yrs = j.requirements.find((r) => r.type === 'experience');
  assert.equal(yrs.priority, 'mandatory');
});

test('extraction: ambiguous numeric deadline is flagged, not silently trusted', () => {
  const d = results.mel.job.fields.deadline;
  assert.equal(d.value, '2026-12-15');
  const amb = E.extractJob('Deadline: 11/12/2026', { today: TODAY }).fields.deadline;
  assert.equal(amb.ambiguous, true);
  assert.equal(amb.confidence, 'low');
});

test('scenario: Senior DRR Adviser — strong alignment, resilience pathway, CCA-DRR CV', () => {
  const { r } = results.drr;
  assert.ok(r.alignment.score >= 70, `alignment ${r.alignment.score}`);
  assert.equal(r.positioning.primary.id, 'resilience_climate');
  assert.ok(cvRank('drr', 'Alvin_Silva_CCA-DRR_CV.pdf') <= 1, 'CCA-DRR CV in top 2');
  assert.notEqual(r.eligibility.status, 'likely ineligible');
  assert.ok(topComp('drr').includes('drr'));
});

test('scenario: Climate Resilience Specialist — CCA competencies surface', () => {
  const { r } = results.climate;
  assert.ok(topComp('climate').some((c) => c === 'cca' || c === 'climate_finance'));
  assert.ok(cvRank('climate', 'Alvin_Silva_CCA-DRR_CV.pdf') <= 1);
  assert.ok(r.alignment.score >= 65, `alignment ${r.alignment.score}`);
});

test('scenario: Strategic Planning Director — strategy pathway, executive gap, manual eligibility', () => {
  const { r, job } = results.strategy;
  assert.equal(job.fields.seniority.value, 5);
  assert.equal(r.positioning.primary.id, 'strategic_advisory');
  assert.ok(r.eligibility.checks.some((c) => c.type === 'eligibility' && c.status === 'manual check'), 'CSEE/CES eligibility is a manual check');
  assert.ok(r.alignment.parts.leadership < 90, 'director level above documented seniority');
  assert.ok(job.documents.some((d) => d.id === 'pds' && d.link === 'pds.html'), 'PDS wired to pds.html');
});

test('scenario: Humanitarian Security Adviser — expired SRMP blocks, French needs verification', () => {
  const { r } = results.humanitarian;
  const cert = r.eligibility.checks.find((c) => c.type === 'certification');
  assert.equal(cert.status, 'expired');
  assert.equal(r.eligibility.status, 'likely ineligible');
  assert.equal(r.decision.code, 'ineligible');
  const lang = r.eligibility.checks.find((c) => c.type === 'language');
  assert.equal(lang.status, 'needs verification');
  assert.ok(r.gaps.some((g) => g.severity === 'blocking'));
});

test('scenario: MEL Specialist — MEL competency weighted; MEL CV ranks high', () => {
  const { r } = results.mel;
  assert.ok(topComp('mel').includes('mel'));
  assert.ok(cvRank('mel', 'Alvin_Silva_MEL_CV.pdf') <= 2, `MEL CV rank ${cvRank('mel', 'Alvin_Silva_MEL_CV.pdf')}`);
  const melGap = r.gaps.find((g) => g.competency === 'mel');
  if (melGap) assert.ok(['evidence', 'competency'].includes(melGap.type));
});

test('scenario: Digital Transformation Adviser — verified training evidence used', () => {
  const { r } = results.digital;
  assert.ok(topComp('digital').includes('digital'));
  const d = r.competencies.find((c) => c.id === 'digital');
  assert.ok(['verified', 'documented'].includes(d.level), d.level);
  assert.ok(r.feasibility.documents.some((x) => x.id === 'technical_proposal'));
  assert.equal(results.digital.job.fields.employmentType.value, 'consultancy');
});

test('scenario: Senior Policy Consultant — policy/governance, prior institution exposure', () => {
  const { r } = results.policy;
  assert.ok(topComp('policy').some((c) => c === 'policy' || c === 'governance'));
  assert.ok(/prior engagement/.test(r.alignment.why.sector), 'The Asia Foundation is in credentials.institutions');
});

test('scenario: Research Fellow — PhD requirement not evidenced', () => {
  const { r } = results.research;
  const edu = r.eligibility.checks.find((c) => c.type === 'education');
  assert.equal(edu.status, 'not evidenced');
  assert.equal(r.eligibility.status, 'likely ineligible');
});

test('negative controls: clearly misaligned roles score well below aligned roles', () => {
  const aligned = ['drr', 'climate', 'policy'].map((k) => results[k].r.alignment.score);
  for (const k of ['nurse', 'backend']) {
    const a = results[k].r.alignment.score;
    assert.ok(a < 55, `${k} alignment ${a} should be < 55`);
    assert.ok(Math.min(...aligned) - a >= 25, `${k} must trail aligned roles by >= 25 points`);
    assert.ok(['deprioritize', 'ineligible', 'stretch'].includes(results[k].r.decision.code), `${k} decision ${results[k].r.decision.code}`);
  }
  assert.equal(results.nurse.r.eligibility.status, 'likely ineligible', 'PRC nursing license not held');
});

test('scenario: Strategic Planning Director — Strategic Planning CV ranks first', () => {
  assert.equal(cvRank('strategy', 'Alvin_Silva_Strategic-Thinking-Planning_CV.pdf'), 0, results.strategy.r.cvs.slice(0, 3).map((c) => c.file + ':' + c.score).join(', '));
  assert.match(results.strategy.job.fields.title.value, /Director, Strategic Planning Office/);
});

test('extraction: header label lines are fields, not requirement statements', () => {
  assert.ok(!results.drr.job.requirements.some((r) => /^(Position Title|Organization|Duty Station)/.test(r.text)));
  assert.ok(!topComp('drr').includes('research'), '"development studies" in a degree line is not research demand');
});

test('claims: a security-toolkit certificate is not cited for a DRR role', () => {
  const { job, r } = results.drr;
  const claims = E.buildClaims(job, r, CREDS);
  assert.ok(!claims.some((c) => /Security Risk Management Toolkit/.test(c.text)));
});

test('separation: deadline affects feasibility, never professional alignment', () => {
  const base = results.drr.job;
  const late = E.applyEdits(base, { deadline: '2026-11-03' });
  const closed = E.applyEdits(base, { deadline: '2026-10-01' });
  const a = E.assess(base, CREDS, { today: TODAY, evidence: ev });
  const b = E.assess(late, CREDS, { today: TODAY, evidence: ev });
  const c = E.assess(closed, CREDS, { today: TODAY, evidence: ev });
  assert.equal(a.alignment.score, b.alignment.score);
  assert.equal(a.alignment.score, c.alignment.score);
  assert.ok(b.feasibility.score < a.feasibility.score);
  assert.equal(c.feasibility.score, 0);
  assert.equal(c.timePriority.code, 'closed');
  assert.equal(b.timePriority.code, 'urgent');
});

test('reproducibility: same inputs → same scores and input hash', () => {
  const j1 = E.extractJob(FIXTURES.policy, { today: TODAY, institutions: CREDS.institutions });
  const j2 = E.extractJob(FIXTURES.policy, { today: TODAY, institutions: CREDS.institutions });
  const r1 = E.assess(j1, CREDS, { today: TODAY });
  const r2 = E.assess(j2, CREDS, { today: TODAY });
  assert.equal(r1.inputHash, r2.inputHash);
  assert.deepEqual(r1.alignment, r2.alignment);
  assert.equal(r1.modelVersion, E.MODEL_VERSION);
});

test('explainability: every alignment part has a reason', () => {
  for (const { r } of Object.values(results)) {
    for (const k of Object.keys(E.ALIGNMENT_WEIGHTS)) assert.ok(r.alignment.why[k], k);
    assert.equal(Object.values(E.ALIGNMENT_WEIGHTS).reduce((a, b) => a + b, 0), 100);
  }
});

test('claims: unverified metrics and expired credentials are never selected by default', () => {
  for (const { job, r } of Object.values(results)) {
    const claims = E.buildClaims(job, r, CREDS);
    claims.filter((c) => c.level === 'unverified' || c.level === 'inferred').forEach((c) => assert.equal(c.selected, false, c.id));
    claims.filter((c) => /expired/.test(c.text)).forEach((c) => assert.equal(c.selected, false, c.id));
  }
});

test('letter: built only from selected claims; no unsupported certifications', () => {
  const { job, r } = results.drr;
  const claims = E.buildClaims(job, r, CREDS);
  const letter = E.composeLetter(job, r, CREDS, claims);
  assert.ok(!/Certified International Humanitarian Practitioner|Certified DRR Practitioner/.test(letter));
  assert.ok(!/households reached/.test(letter), 'unverified households metric excluded');
  assert.ok(!/leadership of/i.test(letter), 'no unsupported leadership claim');
  const none = E.composeLetter(job, r, CREDS, claims.map((c) => Object.assign({}, c, { selected: false })));
  assert.ok(!/Relevant qualifications/.test(none));
  assert.match(letter, /alvin-silva\.asilvainnovations\.com/);
});

if (REPORT) {
  const rows = Object.entries(results).map(([k, { job, r }]) => ({
    scenario: k, title: (job.fields.title.value || '').slice(0, 38), align: r.alignment.score, feas: r.feasibility.score,
    value: r.careerValue.score, conf: r.confidence.label, elig: r.eligibility.status, path: r.positioning.primary.id,
    cv1: r.cvs[0].file.replace('Alvin_Silva_', '').replace('_CV.pdf', ''), decision: r.decision.code
  }));
  console.table(rows);
}
