#!/usr/bin/env python3
"""
Idempotent patcher — asilvainnovations/alvin-silva
Applies ONLY unambiguous mechanical fixes. Judgment calls are left alone
and reported by tools/audit.py instead.

    python3 tools/fix-repo.py            # apply
    python3 tools/fix-repo.py --check    # report what would change, exit 1 if anything would

Microsite pages (personal-resilience/*.html) are generated: their fixes are
applied to the fragments in personal-resilience/_src/ and the pages are
rebuilt with tools/make-microsite.py — never patched in place.
"""
import glob
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
SITE = 'https://alvin-silva.asilvainnovations.com'
changes = []


def edit(relpath, fn, label):
    p = os.path.join(ROOT, relpath)
    if not os.path.exists(p):
        changes.append((relpath, label, 'SKIP (file absent)'))
        return
    src = open(p, encoding='utf-8', errors='replace').read()
    out = fn(src)
    if out == src:
        changes.append((relpath, label, 'no-op (already clean)'))
        return
    if not CHECK:
        open(p, 'w', encoding='utf-8').write(out)
    changes.append((relpath, label, 'WOULD PATCH' if CHECK else 'PATCHED'))


def rel(path):
    return os.path.relpath(path, ROOT)


FRAGMENTS = [rel(f) for f in glob.glob(os.path.join(ROOT, 'personal-resilience', '_src', '*.inc'))]
ROOT_PAGES = sorted(rel(f) for f in glob.glob(os.path.join(ROOT, '*.html')))

# ------------------------------------------------- 1. invalid URI scheme / case / builder artifacts
def fix_fragment(s):
    s = s.replace('href="mail://', 'href="mailto:').replace('mailto://', 'mailto:')
    s = s.replace('href="FAQ.html"', 'href="faq.html"')
    s = s.replace('href="hello@cognitioplus.html"', 'href="mailto:hello@cognitioplus.com"')
    s = re.sub(r'href="privacy-policy\.html"', 'href="../privacy-policy.html"', s)
    s = re.sub(r'href="accessibility(?:\.html)?"', 'href="../accessibility-policy.html"', s)
    return s
for f in FRAGMENTS:
    edit(f, fix_fragment, 'microsite fragment: mailto/case/policy-path fixes')

# ------------------------------------------------- 2. missing #i-send symbol
I_SEND = ('    <symbol id="i-send" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
          'stroke-width="2" stroke-linecap="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></symbol>\n')
def add_i_send(s):
    if 'id="i-send"' in s or '#i-send' not in s:
        return s
    m = re.search(r'^([ \t]*)<symbol id="i-mail".*?</symbol>[ \t]*\r?\n', s, re.M | re.S)
    return s if not m else s[:m.end()] + I_SEND + s[m.end():]
for f in ['building-resilience.html', 'personal-resilience.html']:
    edit(f, add_i_send, 'define missing #i-send symbol')

# ------------------------------------------------- 3. stray </p> directly after a closing block
def fix_stray_p(s):
    # pattern-based (the old version deleted "line 552", which breaks on any edit)
    return re.sub(r'(</(?:div|section|ul|ol|form)>\s*)</p>(\s*\n)', r'\1\2', s, count=1)
edit('chat.html', fix_stray_p, 'remove stray </p> after a closed block')

# ------------------------------------------------- 4. one canonical home (decided 2026-10-22)
def canonical_for(page):
    name = page[:-5]
    return f'{SITE}/' if name == 'index' else f'{SITE}/{name}'
def fix_canonical(page):
    want = canonical_for(page)
    def fn(s):
        s = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{want}">', s, count=1)
        s = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{want}">', s, count=1)
        return s
    return fn
for f in ROOT_PAGES:
    edit(f, fix_canonical(f), f'canonical + og:url -> {SITE}')

# ------------------------------------------------- 5. links to retired mirrors -> local pages
MIRRORS = [
    (r'https://asilvainnovations\.github\.io/website/policies/([a-z-]+\.html)', r'\1'),
    (r'https://asilvainnovations\.github\.io/website/(policies\.html|accessibility-policy\.html|cookie-policy\.html|privacy-policy\.html)', r'\1'),
    (r'https://asilvainnovations\.github\.io/website/terms\.html', 'terms-of-services.html'),
    (r'https://asilvainnovations\.github\.io/alvin-silva/([A-Za-z0-9/_.-]+\.html)', r'\1'),
    (r'https://alvin-portfolio\.asilvainnovations\.com/?(?=["\'])', SITE + '/portfolio'),
]
def fix_mirrors(s):
    for pat, rep in MIRRORS:
        s = re.sub(r'href="' + pat, lambda m: 'href="' + m.expand(rep), s)
    # social preview images: serve from the canonical domain
    s = re.sub(r'content="https://(?:alvin-portfolio\.asilvainnovations\.com|asilvainnovations\.github\.io/alvin-silva)/', f'content="{SITE}/', s)
    # a same-site link must not open a new tab
    s = re.sub(r'(<a href="(?!https?:|mailto:|tel:)[^"]+") target="_blank" rel="noopener noreferrer"', r'\1', s)
    return s
for f in ROOT_PAGES:
    edit(f, fix_mirrors, 'github.io / alvin-portfolio mirror links -> local pages')

# ------------------------------------------------- 6. sw.js precache correctness
def fix_sw(s):
    if "'/style.css'" in s:
        return s
    return s.replace("  '/manifest.webmanifest',", "  '/style.css',\n  '/manifest.webmanifest',")
edit('sw.js', fix_sw, 'precache style.css')

# ------------------------------------------------- report
print('=' * 78)
print('PATCH REPORT' + (' (check only)' if CHECK else ''))
print('=' * 78)
byfile = {}
for r_, label, status in changes:
    byfile.setdefault(status, []).append(f'{r_:<46} {label}')
for status in ('PATCHED', 'WOULD PATCH', 'SKIP (file absent)'):
    rows = byfile.get(status, [])
    if rows:
        print(f'\n--- {status}  ({len(rows)}) ---')
        for r_ in rows:
            print('  ' + r_)
done = [c for c in changes if c[2] in ('PATCHED', 'WOULD PATCH')]
print(f'\n{len(done)} edit(s) {"pending" if CHECK else "applied"}; {len(changes) - len(done)} already clean.')
if FRAGMENTS and not CHECK and any(c[0].startswith('personal-resilience' + os.sep) for c in done):
    print('Fragments changed: run python3 tools/make-microsite.py')
sys.exit(1 if CHECK and done else 0)
