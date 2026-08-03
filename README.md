# Alvin M. Silva — Personal Platform (`alvin-silva`)

**Live:** alvin-silva.asilvainnovations.com · **Portfolio:** alvin-portfolio.asilvainnovations.com
**Owner:** Alvin M. Silva, MDM — Development Management & Resilience Consultant
**Stack:** Static HTML/CSS/vanilla JS, zero build step, deployed via GitHub Pages. No `package.json`, no bundler, no framework.

---

## What this repository actually is

On the surface this looks like a personal website. It's really three connected systems sharing one identity:

1. **A persona-adaptive public site** — `index.html` + `portfolio.html` reshape their content, accent color, and even chatbot framing depending on who's visiting (government official, NGO/humanitarian professional, private-sector leader, or academic).
2. **A private career-operations tool** — `career-automation.html` is a self-contained personal ATS: paste a job posting, get an auto-scored fit analysis, a recommended CV variant (from 10 pre-tailored PDFs), a generated cover letter, and a tracked pipeline — all client-side, no server.
3. **A knowledge-product funnel** — `personal-resilience/`, `building-resilience.html`, and related pages market Alvin's three published books, loosely federated under the same domain.

The intended architecture is a **single source of truth**: `credentials.json` should be the one file that drives the persona-aware chatbot's knowledge, the career tool's scoring, and (implicitly) the site copy. That's a sound design goal. It is not yet fully realized — see **Known Issues** below for exactly where it's forked.

---

## Site map

| Path | Purpose |
|---|---|
| `index.html` | Main landing page — persona engine, hero, track record, expertise, works, contact/lead-capture, cookie consent |
| `portfolio.html` | Full filterable portfolio/publication showcase with lightbox viewer, same persona + lead-capture system |
| `career-automation.html` | Internal tool: job-posting parser → fit scorer → CV recommender → cover-letter generator → application tracker |
| `chat.html` | Standalone full-page version of the AI assistant (shares state with the embedded widget) |
| `form-assistant-setup.html` + `form-assistant-bookmarklet.js` | A browser bookmarklet that autofills job-application forms with Alvin's credentials |
| `building-resilience.html`, `personal-resilience.html`, `personal-resilience/*` | Book marketing/funnel pages for published works |
| `policies.html`, `privacy-policy.html`, `cookie-policy.html`, `terms-of-services.html`, `accessibility-policy.html` | Legal/policy pages (see Known Issues — the site's own nav links past these to a *different* repo) |
| `credentials.json` | Canonical structured profile: bio metrics, institutions, disciplines, projects, publications, CV-version index |
| `Alvin_Silva_CV_Versions/*.pdf` | 10 pre-tailored CV variants (CCA-DRR, MEL, PPP, Political Economy, Project Evaluation, etc.), matched by the career tool's scoring algorithm |
| `assets/asilva-widget.js` | Embeddable floating AI chat widget (persona-aware system prompt, calls the Kimi/Moonshot API with a visitor-supplied key) |
| `sw.js` + `manifest.webmanifest` | PWA support — offline shell caching, installable app shortcuts |

---

## Core features & how they work

### 1. Persona engine
`<html data-persona="government|humanitarian|private|academic|executive">` drives a CSS custom-property cascade (accent colors, copy emphasis) and is read by the chat widget to select one of four tailored system-prompt directives. Persona is stored in `localStorage` (`as-persona`) so it persists across a visit.

### 2. Theming
A three-tier CSS token cascade — `:root` defaults → `prefers-color-scheme` media query → explicit `html[data-theme]` attribute — gives full light/dark support with the persona accent layered on top independently.

### 3. Lead capture
A gated modal (unlocks portfolio access) posts to Supabase (`leads` table, anon-role key embedded client-side — by design, security is meant to live in Supabase RLS policies, not key secrecy) with a `localStorage` fallback if Supabase is unreachable.

### 4. AI chat (two surfaces, one brain)
`chat.html` (full page) and `assets/asilva-widget.js` (floating embed) both implement a Kimi/Moonshot-backed assistant. The visitor supplies their own API key (stored in their own `localStorage`, never sent anywhere but the Moonshot API) — an unusual but deliberate choice that keeps Alvin from paying for every visitor's queries. The system prompt is persona-aware and hardcodes the same metrics that live in `credentials.json` (see Known Issues).

### 5. Career-automation tool
Fully client-side: regex-based job-posting parser → weighted scoring (keyword overlap, sector match, discipline match) → best-fit CV selection from `cv_versions` → templated cover-letter generation → an application tracker persisted in `localStorage`. No backend, no accounts.

### 6. Form-assistant bookmarklet
A `javascript:` bookmarklet that scans any page's form fields by label text, matches them against a hardcoded credentials object, and offers one-click autofill — built for third-party application portals that can't be scraped or automated any other way.

### 7. Accessibility & PWA
Skip-link, ARIA landmarks, an accessibility toolbar, a manifest with install shortcuts (Contact, Impact Timeline), and a stale-while-revalidate service worker caching the core shell for offline access.

---

## Known issues (found during audit, 2026-08-04)

These are handed to you straight because a README that hides known debt isn't useful to future-you.

1. **`credentials.json` has forked into three copies.** The canonical file at the repo root, an inline `CREDENTIALS_FALLBACK` object in `career-automation.html`, and a hardcoded metrics block in `assets/asilva-widget.js`'s `BASE_PROMPT` all restate the same facts independently. Update one, the other two silently go stale.
2. **The fetch that's supposed to prevent #1 is broken.** `career-automation.html` calls `fetch('assets/credentials.json')` — but the file lives at the repo root (`credentials.json`), not under `assets/`. This 404s silently every single load, so the tool *always* runs on the inline fallback, never the live file. One-line fix (`assets/credentials.json` → `credentials.json`), high value.
3. **`sitemap.xml` references pages that don't exist in this repo** — `margallo.html` and `margallo-2.html` are listed with priority 0.7 but there are no such files. Search engines will 404 on them.
4. **The site's own footer/nav links bypass its own local policy pages.** `privacy-policy.html`, `cookie-policy.html`, `terms-of-services.html`, and `accessibility-policy.html` all exist locally, but `index.html`/`portfolio.html` link out to `asilvainnovations.github.io/website/policies/...` — a *different* repository — instead. Either the local copies are dead weight or the links are pointing at the wrong place; worth deciding which is canonical.
5. **`CNAME` was created then deleted** from repo history. If `alvin-silva.asilvainnovations.com` is the intended GitHub Pages custom domain, confirm in repo Settings → Pages that it's still correctly configured.
6. *(Already patched separately, documented in `AUDIT-REPORT.md`)*: two hard JS syntax errors that silently broke the chat widget and the entire career tool, a duplicated `<base target="_blank">` breaking all in-page navigation, and inconsistent output-escaping (XSS hardening) in the career tool and chat widget.

---

## Immediate enhancements (next 1–2 sessions)

- [ ] Fix the `assets/credentials.json` → `credentials.json` fetch path (career-automation.html) — currently the tool never reads live data.
- [ ] Collapse the three credential copies into one: have `asilva-widget.js`'s system prompt and `career-automation.html`'s fallback both `fetch()` the same `credentials.json` at load time, with the inline objects kept *only* as an explicit last-resort fallback, clearly commented as such.
- [ ] Remove or repoint the two dead `sitemap.xml` entries (`margallo.html`, `margallo-2.html`).
- [ ] Decide policy-page ownership: either delete the local `*-policy.html` files and keep the external `website` repo as canonical, or fix the nav/footer links to point locally and treat the `website` repo copies as the fork instead.
- [ ] Confirm `CNAME` / GitHub Pages custom-domain configuration is still live (see Known Issues #5).
- [ ] Confirm Supabase RLS on the `leads` table restricts to insert-only for the `anon` role (flagged in `AUDIT-REPORT.md`, unverifiable from a sandboxed audit — needs a dashboard check).
- [ ] Add a lightweight smoke test (even a manual checklist) run after every deploy: skip-link scrolls in-page, chat widget accepts a key and responds, career tool parses a pasted posting — the three features that were silently broken for an unknown period before this audit.

---

## Continuous innovation (ongoing direction)

- **Turn `credentials.json` into a real API, not a static file.** Even a tiny serverless function (or a Supabase table) serving the same JSON would let the chat widget, career tool, and future integrations (e.g. a public API for third-party recruiters) all read one live source, and would enable versioning/change history instead of git-diffing a JSON blob.
- **Server-side CV generation.** The career tool currently *recommends* one of 10 pre-baked PDFs. A natural next step is generating a bespoke CV per job posting (reusing the `.docx` pipeline already built for manual application work) rather than picking the closest pre-made match.
- **Persona detection beyond self-selection.** Currently the visitor picks their persona via a toggle. Referrer/UTM-based auto-detection (e.g., a link shared in a government mailing list defaults to the `government` persona) would reduce friction.
- **Chat cost model.** The bring-your-own-API-key pattern is clever for cost control but is real friction for a casual visitor. Worth evaluating a low-volume server-side key with rate-limiting for the common case, falling back to BYO-key only past a usage threshold.
- **Consolidate the two chat surfaces.** `chat.html` and `assets/asilva-widget.js` are two separate implementations of very similar logic. Extracting a shared module (or having `chat.html` simply mount the same widget full-screen) would halve the maintenance surface for future fixes.
- **Automated regression checks.** Given that two hard syntax errors shipped to production undetected, even a minimal CI step (`node --check` on every `.js` file and every extracted inline `<script>` on push) would have caught both instantly. This repo has no `.github/workflows` at all currently — that's the highest-leverage single addition available.
- **CV-version freshness tracking.** `credentials.json`'s `cv_versions` array should probably carry a `last_updated` field per PDF so the career tool (or Alvin) can flag when a recommended CV is older than the live achievements list.

---

## Local development

There is no build step. Clone the repo and open `index.html` directly, or serve the folder with any static server (`python3 -m http.server`, `npx serve`, etc.) — a real HTTP server is required for the Supabase `<script type="module">` import and the service worker to function correctly (both fail under `file://`).

```bash
git clone https://github.com/asilvainnovations/alvin-silva.git
cd alvin-silva
python3 -m http.server 8000
# visit http://localhost:8000
```
