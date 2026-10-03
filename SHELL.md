# App shell — navigation, PWA, and progressive disclosure

Every user-facing page now runs inside one shell. Pages own content; the
shell owns navigation, theme, install, and the footer.

## Files

| File | Role |
|---|---|
| `assets/js/core/app-shell.js` | Information architecture (IA), header, bottom bar, sheet, footer, theme, install, disclosure, SW registration |
| `assets/css/app-shell.css` | Shell styles. Self-contained colors, safe-area aware, reduced-motion aware |
| `assets/js/boot.js` | Loads `app-shell.js` first, then core, chat, modules. The only script tag a page needs |
| `sw.js` | Per-file precache, network-first navigations with offline fallback, GET/same-origin only |
| `manifest.webmanifest` | "Alvin Silva Platform", shortcuts aligned to the IA |
| `tools/apply-shell.py` | Idempotent page migration (`--check` = dry run) |
| `tools/validate-shell.py` | Proves IA destinations, precache, manifest, page wiring, inline JS |

## Information architecture

| Tab | Mobile | Desktop | Destinations |
|---|---|---|---|
| Home | link | brand | `index.html` |
| Work | sheet | menu | Portfolio · Track record · Capabilities · Training programs |
| Knowledge | sheet | menu | Writing · Personal Resilience · Building Resilience · Platforms and frameworks · Questions answered |
| Tools | sheet | menu | Ask the assistant · AI-Chorus · *Career workspace (private)* |
| More | sheet | menu | Connect · Preferences (install, theme, lens, accessibility, cookies) · Policies |

To add, rename, or move a destination, edit `IA` in `app-shell.js`, then run
`python3 tools/validate-shell.py`. Never edit navigation in page markup.

### Career workspace visibility

`career-automation.html`, `form-assistant-setup.html`, `pds.html`, and
`tools/blog-composer.html` are `noindex` and are shown in the Tools sheet only
in operator mode:

- turn on: visit any page with `?operator=on` (persists in this browser)
- turn off: `?operator=off`
- always visible on the operator pages themselves

This hides links; it does not restrict access. Set
`IA.careerVisibility = 'public'` to show the workspace to every visitor.

## Page contract

- Load `assets/css/app-shell.css` and `assets/js/boot.js` only.
- Optional: `<body data-shell-page="work">` forces the active tab.
- Optional: `<body data-shell="off">` opts a page out.
- Persona: expose `window.ASilvaOpenPersona` and dispatch
  `as:persona` `{ label }` after applying a lens.
- Cookie settings: listen for `as:cookie-settings`.
- Long lists: `data-disclose-list="3" data-disclose-label="engagements"`
  collapses on screens under 900px.

## Install experience

- Captures `beforeinstallprompt`; offers the card only after engagement
  (second page in the session, 40 s on a page, or half the page read).
- "Not now" backs off 21 days; stops auto-offering after 3 dismissals.
- "Install app" stays in More until installed; iOS Safari gets steps;
  other browsers get an explanation.
- Detects standalone mode and `appinstalled`.

## Verification (this branch)

- `tools/validate-shell.py`: OK (27 IA destinations, 19 pages).
- `tools/apply-shell.py … --check`: no pending changes (idempotent).
- Headless Chromium, 19 pages × mobile 390 px + desktop 1366 px: shell
  renders, correct tab active, no page errors, no same-origin 4xx,
  nothing covers the bottom bar.
- Offline: 42 files precached; cached pages, clean URLs (`/portfolio`), and
  uncached pages (fallback to home) all load with the shell.
- Install: engagement gate, dismissal back-off, More entry, `appinstalled`,
  and iOS guidance verified with a simulated prompt.

## Defects fixed along the way (pre-existing)

- JS pasted inside `<style>` on `index.html`; `<link>`/`<script>` tags pasted
  inside `<style>`/`<script>` on `personal-resilience.html`,
  `form-assistant-setup.html` (the bookmarklet **Copy** button never worked),
  and `tools/blog-composer.html` (its CSS rendered as page text).
- `portfolio.html`: an orphaned fragment of a deleted card broke the whole
  portfolio script, so the grid rendered nothing.
- `404`, `blog`, `chat`, `chorus`: cloned scripts crashed on elements those
  pages never had, disabling consent and accessibility code after the crash.
- Directory with a leading space (`assets/js/ visualizations`); modules in
  `assets/modules/` while `boot.js` and `sw.js` expected `assets/js/modules/`.
- Service worker: atomic `addAll` with missing paths; cached non-GET requests.
- Nested pages fetched `tools/credentials.json`; `style..css` typos.

## Open items (need Alvin's decision or content)

- **Facts disagree across the site:** years (15+ in `credentials.json`,
  18+ elsewhere), book count (2, 3, and 5 appear), `credentials.json` vs
  `data/credentials.json` differ.
- **Domains:** `alvin-`, `alvin-silva.`, `alvin-portfolio.`, `portfolio.`
  `asilvainnovations.com` all appear as canonical/home.
- **Portfolio counts** are hard-coded (27 works, Consulting 10); one card was
  already lost upstream (a "Completion Report" entry).
- **Visitor counter** on index/portfolio is fabricated (3 + your own visits).
- **Three assistants** exist: platform chat (all pages), `asilva-widget.js`
  (removed from shell pages), and APM's own FAQ widget on `apm-ldi.html`.
- **Existing CI validator** (`scripts/validate-static-site.mjs`) was already
  failing on `main` (428 findings, mostly false positives from treating
  `content=` attributes as file paths). Now 353. Needs its own fix.
- `personal-resilience/` microsite pages are out of shell scope.
