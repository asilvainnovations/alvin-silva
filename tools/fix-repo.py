#!/usr/bin/env python3
"""
Idempotent patcher — cognitioplus/alvin-silva
Applies ONLY unambiguous mechanical fixes. Judgment calls are left alone
and reported in the audit summary instead.

Usage: python3 fix-repo.py <repo-root>
"""
import os, re, sys, glob

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
changes = []

def edit(relpath, fn, label):
    p = os.path.join(ROOT, relpath)
    if not os.path.exists(p):
        changes.append((relpath, label, "SKIP (file absent)")); return
    src = open(p, encoding="utf-8", errors="replace").read()
    out = fn(src)
    if out == src:
        changes.append((relpath, label, "no-op (already clean)")); return
    open(p, "w", encoding="utf-8", errors="replace").write(out)
    changes.append((relpath, label, "PATCHED"))

# ---------------------------------------------------------------- 1. mail:// -> mailto:
for f in glob.glob(os.path.join(ROOT, "personal-resilience", "*.html")):
    rel = os.path.relpath(f, ROOT)
    edit(rel, lambda s: s.replace('href="mail://', 'href="mailto:'),
         "mail:// -> mailto: (invalid URI scheme)")

# ---------------------------------------------------------------- 2. FAQ.html -> faq.html
for f in glob.glob(os.path.join(ROOT, "personal-resilience", "*.html")):
    rel = os.path.relpath(f, ROOT)
    edit(rel, lambda s: s.replace('href="FAQ.html"', 'href="faq.html"')
                          .replace('data-mce-href="FAQ.html"', 'data-mce-href="faq.html"'),
         "FAQ.html -> faq.html (case mismatch; 404s on Linux/Vercel)")

# ------------------------------------------------- 3. broken relative policy links in subfolder
def fix_policy_links(s):
    # These live at repo root, not inside personal-resilience/
    s = re.sub(r'href="privacy-policy\.html"', 'href="../privacy-policy.html"', s)
    s = re.sub(r'href="accessibility\.html"', 'href="../accessibility-policy.html"', s)
    return s
for f in glob.glob(os.path.join(ROOT, "personal-resilience", "*.html")):
    edit(os.path.relpath(f, ROOT), fix_policy_links,
         "policy links -> ../ (targets are at repo root)")

# ------------------------------------------------- 4. page-builder export artifacts
def fix_mce_artifacts(s):
    # Builder appended .html to non-path data-mce-href values on export.
    s = s.replace('href="hello@cognitioplus.html"', 'href="mailto:hello@cognitioplus.com"')
    # Empty decorative anchors pointing at a nonexistent page -> inert
    s = s.replace('<a href="alvin-silva.html" data-mce-href="alvin-silva">',
                  '<a href="../index.html" data-mce-href="alvin-silva">')
    return s
for f in glob.glob(os.path.join(ROOT, "personal-resilience", "*.html")):
    edit(os.path.relpath(f, ROOT), fix_mce_artifacts,
         "page-builder export artifacts (.html appended to non-paths)")

# ---------------------------------------------------------------- 5. missing #i-send symbol
I_SEND = ('    <symbol id="i-send" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
          'stroke-width="2" stroke-linecap="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></symbol>\n')
def add_i_send(s):
    if 'id="i-send"' in s:
        return s
    m = re.search(r'^([ \t]*)<symbol id="i-mail".*?</symbol>[ \t]*\r?\n', s, re.M | re.S)
    if not m:
        return s
    return s[:m.end()] + I_SEND + s[m.end():]
for f in ["building-resilience.html", "personal-resilience.html"]:
    edit(f, add_i_send, "define missing #i-send symbol (referenced by Subscribe button)")

# ---------------------------------------------------------------- 6. chat.html stray </p>
def fix_stray_p(s):
    lines = s.split("\n")
    if len(lines) >= 552 and lines[551].strip() == "</p>":
        del lines[551]
        return "\n".join(lines)
    return s
edit("chat.html", fix_stray_p, "remove stray </p> at L552")

# ---------------------------------------------------------------- 7. sw.js precache correctness
def fix_sw(s):
    if "'/style.css'" in s:
        return s
    # 15 pages link style.css but it was never precached -> offline breakage
    return s.replace("  '/manifest.webmanifest',",
                     "  // Added (audit 2026-08-21): 15 pages <link> this stylesheet but it was\n"
                     "  // never precached, so offline loads rendered unstyled.\n"
                     "  '/style.css',\n"
                     "  '/manifest.webmanifest',")
edit("sw.js", fix_sw, "precache style.css (15 pages depend on it)")

# ---------------------------------------------------------------- report
print("=" * 78)
print("PATCH REPORT")
print("=" * 78)
applied = [c for c in changes if c[2] == "PATCHED"]
byfile = {}
for rel, label, status in changes:
    byfile.setdefault(status, []).append(f"{rel:<46} {label}")
for status in ("PATCHED", "no-op (already clean)", "SKIP (file absent)"):
    rows = byfile.get(status, [])
    print(f"\n--- {status}  ({len(rows)}) ---")
    for r in rows[:80]:
        print("  " + r)
print(f"\nTOTAL EDITS APPLIED: {len(applied)}")
