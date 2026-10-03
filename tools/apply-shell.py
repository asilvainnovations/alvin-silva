#!/usr/bin/env python3
"""
apply-shell.py — migrate a page onto the shared app shell.

    python3 tools/apply-shell.py index.html            # apply
    python3 tools/apply-shell.py index.html --check    # dry run, exit 1 if changes pending

Generic steps (every page):
  * viewport-fit=cover (safe-area insets)
  * link assets/css/app-shell.css, fix stale assets/*.css paths
  * remove <script src="sw.js"> (the shell registers the service worker)
  * load only boot.js (boot loads the shell, core, chat and modules)

index.html-specific steps retire the legacy header, drawer, footer,
half-built bottom nav, install banner, and the JS that was pasted into
the <style> block, and patch the inline script to the shell contract.

Idempotent: every step checks for its own marker before acting.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Page:
    def __init__(self, path):
        self.path = path
        self.src = path.read_text(encoding='utf-8')
        self.s = self.src
        self.log = []

    def sub(self, label, pattern, repl, count=0, flags=re.S, required=False):
        new, n = re.subn(pattern, repl, self.s, count=count, flags=flags)
        if n:
            self.s = new
            self.log.append(f'{label} ({n})')
        elif required:
            raise SystemExit(f'[{self.path.name}] expected pattern not found: {label}')
        return n

    def replace(self, label, old, new, required=True):
        if old in self.s:
            self.s = self.s.replace(old, new)
            self.log.append(label)
        elif required and new not in self.s:
            raise SystemExit(f'[{self.path.name}] expected text not found: {label}')

    def cut_between(self, label, start, end, include_end=True):
        """Remove from `start` up to (and including) `end`."""
        i = self.s.find(start)
        if i == -1:
            return
        j = self.s.find(end, i)
        if j == -1:
            raise SystemExit(f'[{self.path.name}] unterminated block: {label}')
        j = j + len(end) if include_end else j
        self.s = self.s[:i] + self.s[j:]
        self.log.append(label)


def prefix_for(path):
    depth = len(path.relative_to(ROOT).parts) - 1
    return '../' * depth


def generic(p):
    pre = prefix_for(p.path)
    p.sub('viewport-fit=cover',
          r'<meta name="viewport" content="(?![^"]*viewport-fit)([^"]*)"',
          r'<meta name="viewport" content="\1, viewport-fit=cover"', count=1)
    p.sub('stale css paths', r'href="((?:\.\./)*)assets/(components|core|visualizations)\.css"',
          r'href="\1assets/css/\2.css"')
    if 'app-shell.css' not in p.s:
        p.sub('link app-shell.css', r'(</head>)',
              f'<link rel="stylesheet" href="{pre}assets/css/app-shell.css">\n\\1', count=1, required=True)
    p.sub('remove sw.js script tag', r'[ \t]*<script[^>]+src="(?:\.\./)*sw\.js"[^>]*></script>\n?', '')
    if pre:
        p.sub('nested page: fix asset-relative paths', r'((?:src|href)=")(assets/|style\.css|manifest\.webmanifest)', r'\1' + pre + r'\2')
    p.sub('remove duplicate module script tags (boot.js loads these)',
          r'[ \t]*<script[^>]+src="(?:\.\./)*assets/js/(?!boot\.js)[^"]+"[^>]*></script>\n?', '')
    p.sub('remove JSON loaded as <script>', r'[ \t]*<script[^>]+src="[^"]+\.json"[^>]*></script>\n?', '')
    p.sub('remove second assistant widget (platform chat is loaded by boot.js)',
          r'[ \t]*<script[^>]+src="(?:\.\./)*assets/asilva-widget\.js"[^>]*></script>\n?', '')
    tags = list(re.finditer(r'[ \t]*<script[^>]+assets/js/boot\.js"[^>]*></script>\n?', p.s))
    for m in reversed(tags[1:]):
        p.s = p.s[:m.start()] + p.s[m.end():]
    if len(tags) > 1:
        p.log.append(f'remove duplicate boot.js tags ({len(tags) - 1})')
    if 'assets/js/boot.js' not in p.s:
        p.sub('add boot.js', r'(</body>)', f'<script src="{pre}assets/js/boot.js" defer></script>\n\\1',
              count=1, required=True)


LEGACY_SCRIPT_PATCHES = [
    # drawer/overlay/menu button no longer exist: make every use null-safe
    (r"\b(mm|overlay|menuBtn)\.(classList|setAttribute|addEventListener)", r"\1?.\2"),
    (r"\$\('#(mmClose|menuBtn|themeToggle|themeToggleMobile|installBtn|installDismiss)'\)\.addEventListener", r"$('#\1')?.addEventListener"),
    (r"document\.getElementById\('(mmClose|menuBtn|themeToggle|themeToggleMobile|installBtn|installDismiss)'\)\.addEventListener",
     r"document.getElementById('\1')?.addEventListener"),
    (r"\$\$\('\.mm-link', mm\)", r"$$('.mm-link', mm || document)"),
    # controls that lived in the legacy chrome, or never existed on some pages
    (r"\$\('#(a11yOpen|pmClose|pmSkip|qcClose|qcSkip)'\)\.addEventListener", r"$('#\1')?.addEventListener"),
    (r"\bmodal\.addEventListener", r"modal?.addEventListener"),
    (r"\bbtt\.(classList|addEventListener)", r"btt?.\1"),
    (r"\$\('#(fPersona)'\)\.value = ([^;\n]+);", r"{ const _el = $('#\1'); if (_el) _el.value = \2; }"),
    (r"\biBanner\.classList", r"iBanner?.classList"),
    # cookie settings now come from the shell (More sheet + footer)
    (r"\$\('#cookieSettings'\)\.addEventListener\('click',", r"window.addEventListener('as:cookie-settings',"),
    (r"document\.getElementById\('cookieSettings'\)\.addEventListener\('click',", r"window.addEventListener('as:cookie-settings',"),
    # persona pill moved into the shell
    (r"\$\('#personaPill \.pp-label'\)\.textContent = ([^;\n]+);",
     r"document.documentElement.dataset.personaLabel = \1; window.dispatchEvent(new CustomEvent('as:persona', { detail: { label: \1 } }));"),
    (r"[ \t]*\$\('#personaPill'\)\.setAttribute\([^\n]*\);\n", ""),
    (r"\$\('#personaPill'\)\.addEventListener\('click', (\w+)\);", r"window.ASilvaOpenPersona = \1;"),
    (r"\$\('#heroTailor'\)\.addEventListener", r"$('#heroTailor')?.addEventListener"),
    # progressive disclosure: no persona modal on arrival
    (r"else setTimeout\(openModal, \d+\);", r"else applyPersona('executive', {announce:false});"),
]


def legacy_chrome(p):
    """Retire the copy-pasted header, drawer, footer and install banner."""
    p.cut_between('remove legacy header', '<header class="site-header">', '</header>\n')
    p.sub('remove standalone legacy header (support page)',
          r'[ \t]*<header class="header">\s*<nav class="nav" aria-label="Main navigation">.*?</header>\n', '', count=1)
    p.sub('remove legacy overlay', r'[ \t]*<div class="overlay" id="overlay"></div>\n?', '')
    p.cut_between('remove legacy mobile drawer', '<nav class="mobile-menu" id="mobileMenu"', '</nav>\n')
    p.cut_between('remove legacy footer', '<footer class="site-footer">', '</footer>\n')
    p.sub('remove legacy install banner',
          r'<div class="install-banner[^>]*>.*?id="installDismiss"[^>]*>.*?</button>\s*</div>\n?', '', count=1)
    p.sub('remove inline SW registration',
          r"if \('serviceWorker' in navigator\) \{\s*window\.addEventListener\('load', \(\) => navigator\.serviceWorker\.register\([^)]*\)\.catch\(\(\) => \{\}\)\);\s*\}\n?", '')

    ids = set(re.findall(r'\sid="([^"]+)"', re.sub(r'<script\b[^>]*>.*?</script>', '', p.s, flags=re.S)))

    def guard_missing(body):
        # Scripts cloned from index.html reference elements this page never had.
        # Make method calls on those lookups null-safe; guard property writes.
        lookup = r"(\$\('#([\w-]+)'\)|document\.getElementById\('([\w-]+)'\))"
        def call(m):
            el = m.group(2) or m.group(3)
            return m.group(0) if el in ids else m.group(1) + '?.' + m.group(4)
        body = re.sub(lookup + r"\.(addEventListener|classList|setAttribute|removeAttribute|querySelector|querySelectorAll|focus|click)\b",
                      call, body)
        def write(m):
            el = m.group(2) or m.group(3)
            if el in ids:
                return m.group(0)
            return '{ const _el = ' + m.group(1) + '; if (_el) _el.' + m.group(4) + ' = ' + m.group(5) + '; }'
        body = re.sub(r'(?<![.\w])' + lookup + r"\.(textContent|innerHTML|value|checked|hidden|disabled)\s*=\s*([^;\n]+);", write, body)
        return body

    def patch(m):
        body = m.group(2)
        for pat, rep in LEGACY_SCRIPT_PATCHES:
            body = re.sub(pat, rep, body)
        body = guard_missing(body)
        return m.group(1) + body + m.group(3)
    before = p.s
    p.s = re.sub(r'(<script(?![^>]*\bsrc=)[^>]*>)(.*?)(</script>)', patch, p.s, flags=re.S)
    if p.s != before:
        p.log.append('patch inline scripts for shell contract')


def index_specific(p):
    # 1 · JavaScript that had been pasted inside the <style> block.
    p.cut_between('remove JS inside <style>',
                  '/* ================================================================\n   MOBILE APPLICATION NAVIGATION CONTROLLER',
                  '\n})();\n')
    # 2 · CSS for the half-built bottom nav (superseded by app-shell.css).
    p.cut_between('remove legacy .mobile-app-nav CSS',
                  '/* ================================================================\n   PERSISTENT MOBILE APPLICATION NAVIGATION\n   ================================================================ */',
                  '.mobile-app-nav__item {\n    transition: none;\n  }\n\n}\n')
    # 3 · Legacy header, drawer overlay, and drawer.
    p.cut_between('remove legacy header', '<header class="site-header">', '</header>\n')
    p.cut_between('remove legacy overlay', '<div class="overlay" id="overlay"></div>\n', '\n', include_end=True)
    p.cut_between('remove legacy mobile drawer', '<nav class="mobile-menu" id="mobileMenu"', '</nav>\n')
    # 4 · Legacy footer (navigation moves to the shell; identity + legal stay).
    p.cut_between('remove legacy footer', '<footer class="site-footer">', '</footer>\n')
    # 5 · Half-built bottom nav markup and its comment.
    p.cut_between('remove legacy bottom-nav markup',
                  '<!-- ============================================================\nPERSISTENT MOBILE APPLICATION NAVIGATION',
                  '</nav>\n')
    # 6 · Legacy install banner (one install experience: the shell's).
    p.cut_between('remove legacy install banner', '<div class="install-banner glass-gold" id="installBanner"',
                  'id="installDismiss" aria-label="Dismiss">\u2715</button>\n</div>\n')

    # 7 · Inline script: theme now lives in the shell.
    p.cut_between('remove inline theme block', '(function themeInit() {\nconst THEME_KEY', '})();\n')

    # 8 · Inline script: dropdown + drawer controller (elements no longer exist).
    p.cut_between('remove dropdown/drawer controller',
                  "$$('[data-drop] > .drop-btn').forEach(btn => {\nbtn.addEventListener('click', e => {\ne.stopPropagation();\nconst drop",
                  "$$('.mm-link', mm).forEach(a => a.addEventListener('click', closeMobile));\n")
    p.replace('escape handler without drawer',
              "if (e.key === 'Escape') { closeMobile(); closeModal(); $$('[data-drop]').forEach(d => d.classList.remove('open')); }",
              "if (e.key === 'Escape') { closeModal(); }")

    # 9 · Persona: null-safe, announce to the shell, no auto-opening modal.
    p.replace('persona label null-safe + event',
              "$('#personaPill .pp-label').textContent = P.label;\n$('#personaPill').setAttribute('aria-label', `Change audience profile. Current: ${P.label}`);\n$$('.mm-persona .chip')",
              "document.documentElement.dataset.personaLabel = P.label;\nwindow.dispatchEvent(new CustomEvent('as:persona', { detail: { key, label: P.label } }));\n$$('.mm-persona .chip')")
    p.replace('persona chips no drawer close',
              "applyPersona(b.dataset.setPersona);\ncloseModal(); closeMobile();",
              "applyPersona(b.dataset.setPersona);\ncloseModal();")
    p.replace('persona opener exposed to shell',
              "$('#personaPill').addEventListener('click', openModal);\n$('#heroTailor').addEventListener('click', openModal);",
              "window.ASilvaOpenPersona = openModal;\n$('#heroTailor')?.addEventListener('click', openModal);")
    p.replace('no auto persona modal on first visit',
              "if (saved && PROFILES[saved]) applyPersona(saved, {announce:false});\nelse setTimeout(openModal, 700);",
              "applyPersona(saved && PROFILES[saved] ? saved : 'executive', {announce:false});")

    # 10 · SW registration + legacy install banner logic → shell.
    p.cut_between('remove inline SW + install banner logic',
                  "if ('serviceWorker' in navigator) {\nwindow.addEventListener('load', () => navigator.serviceWorker.register('sw.js')",
                  "window.addEventListener('appinstalled', () => { iBanner.classList.remove('show'); toast('Installed — see you on the home screen'); });\n")

    # 11 · Cookie settings come from the shell (More sheet, footer).
    p.replace('cookie settings via shell event',
              "$('#cookieSettings').addEventListener('click', () => {",
              "window.addEventListener('as:cookie-settings', () => {")

    # 12 · Quick-connect install button delegates to the shell.
    p.sub('quick-connect install via shell',
          r"installBtn\.addEventListener\('click', async \(\) => \{\n\s*if \(window\.deferredPrompt\) \{.*?\n    \}\);\n",
          "installBtn.addEventListener('click', () => {\n        closeModal();\n        if (window.ASilvaShell) window.ASilvaShell.install();\n    });\n",
          count=1)

    # 12b · No-JS navigation (the shell needs JS; content must not).
    if 'class="shl-noscript"' not in p.s:
        p.replace('noscript navigation', '<main id="main">',
                  '<noscript><nav class="shl-noscript" aria-label="Primary"><a href="portfolio.html">Portfolio</a><a href="blog.html">Writing</a>'
                  '<a href="chat.html">Assistant</a><a href="#contact">Contact</a><a href="policies.html">Policies</a></nav></noscript>\n<main id="main">')

    # 13 · Progressive disclosure on long lists (mobile only).
    p.replace('disclose capabilities',
              '<div class="exp-grid" id="expGrid">',
              '<div class="exp-grid" id="expGrid" data-disclose-list="3" data-disclose-label="disciplines">')
    p.replace('disclose timeline',
              '<div class="timeline">',
              '<div class="timeline" data-disclose-list="3" data-disclose-label="engagements">')

    # 14 · "What can I do here?" — intent strip directly after the hero.
    if 'id="start"' not in p.s:
        hero_end = p.s.find('</section>', p.s.find('<section class="hero" id="top">'))
        if hero_end == -1:
            raise SystemExit('hero section not found')
        hero_end += len('</section>')
        p.s = p.s[:hero_end] + '\n' + INTENT_STRIP + p.s[hero_end:]
        p.log.append('insert intent strip')
    if '.intent-grid' not in p.s:
        p.replace('intent strip styles', '</style>\n<script type="module">', INTENT_CSS + '</style>\n<script type="module">')


INTENT_STRIP = '''<section class="intent" id="start" aria-labelledby="start-title">
<div class="wrap">
<h2 class="intent-title" id="start-title">What brings you here?</h2>
<ul class="intent-grid">
<li><a class="intent-card" href="portfolio.html"><span class="intent-label">See the work</span><span class="intent-desc">Platforms, plans, and reports, with links to each deliverable</span></a></li>
<li><a class="intent-card" href="blog.html"><span class="intent-label">Read the thinking</span><span class="intent-desc">Books and notes on systems, evaluation, and resilience</span></a></li>
<li><a class="intent-card" href="chat.html"><span class="intent-label">Ask a question</span><span class="intent-desc">The assistant answers from Alvin&rsquo;s verified record</span></a></li>
<li><a class="intent-card intent-card--primary" href="#contact"><span class="intent-label">Start a conversation</span><span class="intent-desc">Describe the outcome you&rsquo;re accountable for</span></a></li>
</ul>
</div>
</section>
'''

INTENT_CSS = '''/* ============ INTENT STRIP (app shell, progressive disclosure) ============ */
.intent { padding: 1.25rem 0 .5rem; position: relative; }
.intent-title { font-size: 1.05rem; font-weight: 700; margin: 0 0 .75rem; color: var(--text); }
.intent-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; grid-template-columns: 1fr 1fr; }
.intent-card { display: flex; flex-direction: column; gap: .3rem; height: 100%; min-height: 96px; padding: .9rem; border-radius: 14px;
  text-decoration: none; color: var(--text); background: var(--card); border: 1px solid var(--line); }
.intent-card:hover { border-color: var(--sky); color: var(--text); }
.intent-card--primary { border-color: var(--line-gold); }
.intent-label { font-family: var(--font-display); font-weight: 700; font-size: .98rem; }
.intent-desc { font-size: .8rem; line-height: 1.4; color: var(--text-3); }
@media (min-width: 900px) { .intent-grid { grid-template-columns: repeat(4, 1fr); } .intent { padding-top: 2rem; } }
'''


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--check' in sys.argv
    if not args:
        raise SystemExit(__doc__)
    pending = False
    for a in args:
        path = (ROOT / a).resolve()
        p = Page(path)
        generic(p)
        if path.name == 'index.html' and path.parent == ROOT:
            index_specific(p)
        else:
            legacy_chrome(p)
        changed = p.s != p.src
        pending |= changed
        status = 'would change' if check else ('updated' if changed else 'already applied')
        print(f'{a}: {status if changed else "already applied"}')
        for line in p.log:
            print(f'  - {line}')
        if changed and not check:
            path.write_text(p.s, encoding='utf-8')
    sys.exit(1 if (check and pending) else 0)


if __name__ == '__main__':
    main()
