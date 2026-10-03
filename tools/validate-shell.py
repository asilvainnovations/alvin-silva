#!/usr/bin/env python3
"""
validate-shell.py — prove the navigation shell is wired correctly.

    python3 tools/validate-shell.py          # exit 1 on any failure

Checks
  1. Every internal IA destination in app-shell.js exists (file + #anchor).
  2. Every sw.js PRECACHE entry exists on disk.
  3. manifest.webmanifest icons and shortcut targets exist.
  4. Every shell page links app-shell.css, loads boot.js exactly once,
     has no <script src="sw.js">, no direct core/module script tags,
     no duplicate ids, and every local src/href resolves.
  5. Every inline <script> passes `node --check`.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
SHELL_JS = ROOT / 'assets/js/core/app-shell.js'
SHELL_PAGES = [
    'index.html', '404.html', 'portfolio.html', 'apm-ldi.html', 'blog.html',
    'personal-resilience.html', 'building-resilience.html', 'chat.html', 'chorus.html',
    'career-automation.html', 'form-assistant-setup.html', 'pds.html', 'support.html',
    'policies.html', 'privacy-policy.html', 'cookie-policy.html', 'terms-of-services.html',
    'accessibility-policy.html', 'tools/blog-composer.html',
]
failures = []
warnings = []


def fail(msg):
    failures.append(msg)


def ids_in(path):
    return set(re.findall(r'\sid="([^"]+)"', path.read_text(encoding='utf-8', errors='replace')))


def check_target(href, origin, base=ROOT):
    if re.match(r'^(https?:|mailto:|tel:|data:|javascript:|#$|//)', href) or href == '':
        return
    u = urlparse(href)
    if not u.path:  # pure anchor in same file
        if u.fragment and u.fragment not in ids_in(origin):
            fail(f'{origin.relative_to(ROOT)}: anchor #{u.fragment} not found')
        return
    target = (ROOT / u.path.lstrip('/')) if u.path.startswith('/') else (base / u.path)
    target = target.resolve()
    if target.is_dir():
        target = target / 'index.html'
    if not target.exists():
        fail(f'{origin.relative_to(ROOT)}: missing {href}')
        return
    if u.fragment and target.suffix == '.html' and u.fragment not in ids_in(target):
        fail(f'{origin.relative_to(ROOT)}: {href} — anchor not found in {target.name}')


# 1 · IA destinations
js = SHELL_JS.read_text(encoding='utf-8')
ia_hrefs = re.findall(r"href:\s*'([^']+)'", js)
for h in ia_hrefs:
    check_target(h, SHELL_JS)
page_map = re.search(r'pages:\s*\{(.*?)\}', js, re.S).group(1)
for key in re.findall(r"'([\w-]*)':", page_map):
    if key and not (list(ROOT.glob(f'{key}.html')) or list(ROOT.glob(f'*/{key}.html'))):
        fail(f'IA.pages maps "{key}" but no {key}.html exists')

# 2 · precache
sw = (ROOT / 'sw.js').read_text(encoding='utf-8')
pre = re.search(r'PRECACHE\s*=\s*\[(.*?)\];', sw, re.S).group(1)
for path in re.findall(r"'([^']+)'", pre):
    p = ROOT / path.lstrip('/')
    if path != '/' and not p.exists():
        fail(f'sw.js precache: missing {path}')

# 3 · manifest
man = json.loads((ROOT / 'manifest.webmanifest').read_text(encoding='utf-8'))
for icon in man.get('icons', []) + [i for s in man.get('shortcuts', []) for i in s.get('icons', [])]:
    if not (ROOT / icon['src'].lstrip('/')).exists():
        fail(f'manifest icon missing: {icon["src"]}')
for s in man.get('shortcuts', []):
    check_target(urlparse(s['url']).path + ('#' + urlparse(s['url']).fragment if urlparse(s['url']).fragment else ''),
                 ROOT / 'manifest.webmanifest')

# 4 + 5 · pages
for rel in SHELL_PAGES:
    path = ROOT / rel
    if not path.exists():
        fail(f'{rel}: page listed in SHELL_PAGES does not exist')
        continue
    s = path.read_text(encoding='utf-8', errors='replace')
    if 'app-shell.css' not in s:
        fail(f'{rel}: app-shell.css not linked')
    n_boot = len(re.findall(r'<script[^>]+assets/js/boot\.js', s))
    if n_boot != 1:
        fail(f'{rel}: boot.js loaded {n_boot} times (expected 1)')
    if re.search(r'<script[^>]+src="[^"]*sw\.js"', s):
        fail(f'{rel}: sw.js loaded as a page script')
    direct = re.findall(r'<script[^>]+src="[^"]*assets/js/(?!boot\.js)[^"]+"', s)
    if direct:
        fail(f'{rel}: {len(direct)} module script tags bypass boot.js')
    ids = re.findall(r'\sid="([^"]+)"', s)
    dups = sorted({i for i in ids if ids.count(i) > 1})
    if dups:
        fail(f'{rel}: duplicate ids {dups[:6]}')
    # tags pasted inside <style>/<script> are inert text: a recurring defect here
    for m in re.finditer(r'<(script|style)\b[^>]*>(.*?)</\1>', s, re.S):
        if re.search(r'<(link|script|style)\b', m.group(2)):
            fail(f'{rel}: markup tag pasted inside <{m.group(1)}> near line {s[:m.start()].count(chr(10)) + 1}')
    # local references (skip inline-script and inline-style content)
    markup = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', '', s, flags=re.S)
    for attr, ref in re.findall(r'\s(src|href)="([^"]+)"', markup):
        if '${' in ref:
            continue
        check_target(ref, path, base=path.parent)
    for m in re.finditer(r'<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>', s, re.S):
        attrs, body = m.group(1), m.group(2)
        if 'application/ld+json' in attrs or 'application/json' in attrs or not body.strip():
            continue
        suffix = '.mjs' if 'module' in attrs else '.js'
        with tempfile.NamedTemporaryFile('w', suffix=suffix, delete=False) as fh:
            fh.write(body)
        r = subprocess.run(['node', '--check', fh.name], capture_output=True, text=True)
        if r.returncode:
            fail(f'{rel}: inline script syntax error — {r.stderr.strip().splitlines()[-1][:160]}')

print(f'checked {len(ia_hrefs)} IA destinations, {len(SHELL_PAGES)} pages')
for w in warnings:
    print('WARN ', w)
for f in failures:
    print('FAIL ', f)
print('OK' if not failures else f'{len(failures)} failure(s)')
sys.exit(1 if failures else 0)
