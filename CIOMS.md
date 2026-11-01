# CIOMS — Career Intelligence & Opportunity Management System

`career-automation.html` is now a private career workspace built on the platform's
own architecture (boot.js → registry → shared data service). This document is the
architecture note, data contract and audit traceability record for the
2026-11-02 upgrade (audit phases **D1 + D2**, with D3–D6 foundations).

## Architecture

```
credentials.json ──► ASilva.data (core/data.js) ──► career-engine.js ──► career-workspace.js
   (public facts)       only loader, validates,       pure functions,       UI module, mounts
                        evaluates expiry               tested in CI          [data-asilva-career]
                                                                                   │
tools/build-profile.py ──► Edge_Extension/content.js, form-assistant.js            ▼
   (generated, CI --check)                                               career-store.js
                                                                         private records
                                                                  localStorage ◄──► Supabase (optional)
                                                                  "asilva:career:v3"   RLS + audit
                                                                                       job-extract fn
```

| Layer | File | Responsibility |
|---|---|---|
| Data | `assets/js/core/data.js` | Sole loader of `credentials.json`; passes **every** collection through; schema validation (`_problems`); runtime certificate expiry; provenance (`_source`); cache key v2 |
| Compat | `assets/js/services/credentials-service.js` | Thin facade over `ASilva.data` (was a second, independent loader) |
| Engine | `assets/js/modules/career-engine.js` | Extraction, taxonomy, evidence index, eligibility, three scores, gaps, CV ranking, positioning, claims, letters. No DOM, no storage |
| Store | `assets/js/modules/career-store.js` | Private records, legacy migration, retention, JSON/CSV export-import, optional Supabase sync |
| UI | `assets/js/modules/career-workspace.js` | Overview · Discover · Assess · Applications · Evidence · Development · Analytics · Settings |
| Page | `career-automation.html` | Markup and styles only; loads **only** `boot.js` |
| Backend (optional) | `supabase/migrations/…_cioms_career_records.sql`, `supabase/functions/job-extract/` | Private records with RLS + audit trail; SSRF-protected posting retrieval |
| Tests | `scripts/test-career-engine.mjs` | 21 checks incl. 8 audit scenarios and 2 negative controls |

## The assessment model (`cioms-fit-3.0.0`)

Scores are **separate**, never blended into one number:

| | Question | Components (weight) |
|---|---|---|
| Eligibility | Can I apply at all? | Explicit checks per mandatory requirement: `met`, `likely met`, `needs verification`, `manual check`, `not evidenced`, `expired`. Legal/administrative eligibility is always `manual check`. |
| A · Professional alignment | Does it match my demonstrated profile? | mandatory 15 · competencies 20 · comparable projects 20 · leadership & seniority 15 · sector & institutional context 10 · geography 5 · evidence quality 10 · career direction 5 |
| B · Application feasibility | Can I submit a competitive application in time? | time vs. estimated preparation 40 · documents 25 · eligibility clarity 25 · conditions 10 |
| C · Career value | Is it worth it for my trajectory? | seniority step 25 · pathway priority 30 · institutional exposure 20 · contribution 15 · contract 10 |
| Time priority | When must I act? | closed / act now / this week / plan / monitor — not a score |
| Confidence | How reliable is this assessment? | extraction completeness + evidence quality |

Key behaviors (all covered by tests): deadlines change feasibility, never alignment;
requirements outside the taxonomy count as **unmet** (no silent inflation); expired
credentials add no strength and block when mandatory; keyword-only project links are
`inferred`, not `documented`; same inputs → same scores and input hash.

Evidence levels: **Verified** (credential ID / verify URL / evidence file / resolution
reference) · **Documented** (project record, publication, degree) · **Self-reported**
(discipline years, profile metrics) · **Inferred** (single keyword link) · **Unknown**.

Letters are composed only from selected claims. Unverified metrics, inferred links and
expired credentials are never selected by default; projects without a recorded `role`
are described as work, never as leadership.

## Private data

* Records: `localStorage["asilva:career:v3"]` (schema 3). Never precached by `sw.js`.
* Legacy `as-career-tracker` data is migrated once; the original is kept under
  `asilva:career:legacy-backup` until removed in Settings.
* Retention: text and letters of closed records are purged after N days (default 365).
* CSV export neutralizes spreadsheet formulas; salary expectations are excluded.

## Enabling the private backend (optional)

1. Create a Supabase project; run `supabase/migrations/20261102000000_cioms_career_records.sql`.
2. Auth → Users: create your account (sign-ups are not needed; the client uses `create_user:false`).
   Auth → URL configuration: add `https://alvin-silva.asilvainnovations.com/career-automation` as a redirect URL.
3. `supabase functions deploy job-extract` (keep JWT verification on). Optional secrets:
   `ALLOWED_EMAILS=you@…`, `ALLOWED_HOSTS=reliefweb.int,devex.com,…`, `ALLOWED_ORIGINS=https://alvin-silva.asilvainnovations.com`.
4. In the workspace: Settings → Private backend → project URL + anon key → send sign-in link.

Until configured, everything works locally and the UI says so.

## Validation

```
node scripts/test-career-engine.mjs --report   # engine evaluation suite
python3 tools/validate-shell.py                 # wiring, precache, no direct module tags
python3 tools/build-profile.py --check          # extension/bookmarklet profiles in sync
node scripts/validate-static-site.mjs
```
All four run in `.github/workflows/validate.yml`.

## Audit traceability (review dated 2026-11)

| Audit item | Status | Where |
|---|---|---|
| 2.1 Duplicated data sources | **Done** — inline fallback removed; `data.js` is sole loader; credentials-service is a facade; extension/bookmarklet generated + CI-checked | data.js, credentials-service.js, tools/build-profile.py |
| 2.2 SW / private data classes | **Done** — workspace code precached, records never cached | sw.js |
| 2.3 Extension profile drift | **Done** — removed unsupported "Certified International Humanitarian / DRR Practitioner" claims, ₱190M→₱369M total, 3→5 books, correct LinkedIn, expired SRMP-C dated | Edge_Extension/content.js, form-assistant.js |
| 3.1 Urgency distorting ranking | **Done** — fit / feasibility / time priority separated | career-engine.js |
| 3.2 Keywords ≠ semantics | **Partial** — sectioned requirement parsing, mandatory vs preferred, 21-competency taxonomy with synonyms. No embedding/LLM semantics | career-engine.js |
| 3.3 Experience scoring | **Done** — per-requirement domain years vs total years, unmapped domains not credited | checkRequirement() |
| 3.4 Jaccard dilution | **Done** — competency-weighted coverage, documentation-quality factor | assess() |
| 3.5 Institutional over-weight | **Done** — institution is +10 within a 10% component | assess() |
| 3.6 Gap analysis | **Done** — competency vs evidence vs credential vs eligibility vs data gaps, with responses | assess() |
| 3.7 Schema drift / expired cert | **Done** — top-level certifications used; expiry evaluated at runtime | data.js, engine |
| 3.8 Multidimensional model | **Done** (starting weights; calibrate with real outcomes) | engine |
| 3.9 Confidence & evidence levels | **Done** | engine, Evidence tab |
| 4.1 Browser storage | **Partial** — versioned store, export/import, retention, optional RLS backend. Backend not deployed | career-store.js, supabase/ |
| 4.2 Server-side extraction | **Built, not deployed** — SSRF checks, redirects, size/type limits, auth | supabase/functions/job-extract |
| 4.3 Evidence-backed letters | **Done** — claim selection with sources and levels | buildClaims/composeLetter |
| 4.4 Date parsing, URL validation, timers, CSV injection, inline handlers, ID collisions, duplicates, credential load errors, model version | **Done** | engine, store, workspace |
| D3 Decision support | **Done** — decision with strengths, strategic value, blockers; pathways | Assess tab |
| D4 Application lifecycle | **Mostly done** — stages, history, documents, contacts, follow-ups, interviews, outcome, .ics. Cross-device needs backend | Applications tab |
| D5 Development | **Done (foundation)** — recurring gaps → plan items with status, target, reassessment note | Development tab |
| D6 Analytics | **Done (foundation)** — funnel with denominators, sector/CV/pathway tables, lead time, model check, small-n flags | Analytics tab |
| Domain 1 automated discovery | **Not implemented** — curated source registry + quick capture only; scheduled scanning needs the backend | Discover tab |
| Scheduled notifications | **Not implemented** server-side — on-open reminders + .ics export | Overview |

## Known data gaps that limit accuracy (fix in credentials.json)

* 20 of 24 projects have no `description`, 21 no `client`, 22 no `role` → letters can only describe the work.
* No `languages` field → every language requirement is "needs verification".
* `households_reached` is marked UNVERIFIED → withheld from letters and the assistants.
* Two CV files exist without metadata in `cv_versions`: `Alvin_Silva_Hybrid_Professional_CV.pdf`, `Alvin_Silva_IPA_Sr_Policy_Manager_Embedded_Labs_CV.pdf` (and `Alvin-Silva-CV-Hybrid-Professional.pdf`).

## Out of scope, observed

* `assets/js/ visualizations/` has a leading space in its directory name. Nothing references it today, but any future `<script src>` to it will 404 silently. Rename to `assets/js/visualizations/` before using it.
* `tools/audit.py` still reports 51 broken internal references in 6 pages (mostly `personal-resilience/`) — unchanged by this work.
