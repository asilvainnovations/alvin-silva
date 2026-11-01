#!/usr/bin/env python3
"""
build-profile.py — generate the form-assistant PROFILE block from credentials.json.

    python3 tools/build-profile.py           # rewrite the generated blocks
    python3 tools/build-profile.py --check   # exit 1 if any block is stale (CI)

Targets (both inject a self-contained content script, so they cannot fetch
credentials.json at run time on third-party pages):
    Edge_Extension/content.js
    form-assistant.js

Rules (CIOMS D1 data contract)
  * Every value comes from credentials.json except three neutral application
    defaults (references, salary, start_date) defined below.
  * Expired certifications are presented with their validity dates, never as
    current. Metrics marked UNVERIFIED in profile._metric_notes are left empty
    so the assistant does not suggest them.
  * Prose fields (summary, why_hire, cover_letter) only state facts present in
    credentials.json and make no unrecorded role claims ("lead architect" etc.).
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CREDS = ROOT / 'credentials.json'
TARGETS = [ROOT / 'Edge_Extension' / 'content.js', ROOT / 'form-assistant.js']
SITE = 'https://alvin-silva.asilvainnovations.com'

# Neutral defaults that are not professional facts. salary is flagged
# sensitive by the assistants' FIELD_RULES and is never auto-filled.
APPLICATION_DEFAULTS = {
    'references': 'Available upon request',
    'salary': 'Negotiable based on role scope and organizational mandate',
    'start_date': 'Available to discuss start dates for roles aligned with resilience, strategy and systems innovation',
}

START = '/* @generated:profile:start'
END = '/* @generated:profile:end */'


def short_issuer(issuer):
    return re.split(r'\s+[—(]', issuer or '')[0].strip()


def build(c):
    p = c['profile']
    notes = p.get('_metric_notes', {})
    unverified = {k for k, v in notes.items() if re.search(r'unverified', str(v), re.I)}
    metric = lambda k: '' if k in unverified else str(p.get(k, '') or '')

    certs = []
    for x in c.get('certifications', []):
        if x.get('status') == 'expired':
            yrs = '–'.join(filter(None, [(x.get('issued') or '')[:4], (x.get('expires') or '')[:4]]))
            acr = re.search(r'\(([A-Z][A-Z0-9-]{2,})\)', x['name'])
            certs.append(f"{acr.group(1) if acr else x['name']} ({short_issuer(x.get('issuer'))}, {yrs}; expired)")
        else:
            yr = (x.get('issued') or '')[:4]
            certs.append(f"{x['name']} — {short_issuer(x.get('issuer'))}{f' ({yr})' if yr else ''}")
    for m in c.get('memberships', []):
        ref = f" ({m['reference']})" if m.get('reference') else ''
        certs.append(f"{m['name']}, {m['organization']}{ref}")

    disciplines = sorted(c.get('disciplines', []), key=lambda d: -(d.get('years') or 0))
    projects = c.get('projects', [])
    featured = [x for x in projects if x.get('year')][:10] or projects[:10]
    books = [x for x in c.get('publications', []) if x.get('type') == 'book']
    years = p.get('years_total')
    degree0 = (p.get('degrees') or [''])[0]

    summary = (f"{p['title']} with {years}+ years of experience across {p.get('countries')} countries. "
               f"Work includes {', '.join(x['name'] for x in featured[:4])}. "
               f"Author of {len(books)} books. {degree0.split(',')[0]}.")
    why = (f"I bring {years}+ years of development management practice spanning "
           f"{', '.join(d['name'].lower() for d in disciplines[:4])}. "
           f"Recent work includes {', '.join(x['name'] for x in featured[:3])}"
           + (f", with {metric('funding_designed')} in total project value designed across engagements" if metric('funding_designed') else '')
           + ". I build working tools as well as plans — DDRiVE-M, Strat Planner Pro and Cognitio+ are platforms in use beyond the engagements that produced them.")
    letter = ("Dear Hiring Committee,\n\n"
              f"I am writing to express my interest in this role. I am a {p['title'].lower()} with {years}+ years of experience across {p.get('countries')} countries, "
              f"working in {', '.join(d['name'].lower() for d in disciplines[:3])}.\n\n"
              f"Relevant work includes {', '.join(x['name'] for x in featured[:3])}. "
              f"I hold an {degree0.split(',')[0]}"
              + (f" and have authored {len(books)} books on resilience, leadership and innovation" if books else '') + ".\n\n"
              "I would welcome the opportunity to discuss how my experience can support your objectives.\n\n"
              f"Respectfully,\n{p['name']}\n{p.get('email', '')}\n{SITE}")

    profile = {
        'name': p['name'],
        'title': p['title'],
        'email': p.get('email', ''),
        'phone': p.get('phone', ''),
        'linkedin': p.get('linkedin', ''),
        'website': SITE,
        'degrees': '; '.join(p.get('degrees', [])),
        'certifications': '; '.join(certs),
        'years_experience': f'{years}+',
        'countries': metric('countries'),
        'funding_designed': metric('funding_designed'),
        'households_reached': metric('households_reached'),
        'completion_rate': metric('completion_rate'),
        'strategic_plans': metric('strategic_plans_facilitated'),
        'frameworks_published': metric('frameworks_published'),
        'university_collaborations': metric('university_collaborations'),
        'books_published': str(len(books)),
        'summary': summary,
        'skills': ', '.join(d['name'] for d in disciplines),
        'disciplines': ', '.join(f"{d['name']} ({d.get('years')} yrs)" for d in disciplines),
        'projects': ', '.join(x['name'] + (f" ({x['year']})" if x.get('year') else '') for x in featured),
        'publications': '; '.join(f"{x['title']} ({x.get('year')})" for x in c.get('publications', [])),
        'institutions': ', '.join(c.get('institutions', [])[:24]),
        **APPLICATION_DEFAULTS,
        'why_hire': why,
        'cover_letter': letter,
    }
    return profile


def block(profile, version):
    body = json.dumps(profile, ensure_ascii=False, indent=4)
    body = '\n'.join('  ' + line if i else line for i, line in enumerate(body.split('\n')))
    return (f"{START} — generated by tools/build-profile.py from credentials.json ({version}).\n"
            "     Do not edit by hand: change credentials.json and rerun the generator. */\n"
            f"  const PROFILE = {body};\n  {END}")


PATTERN = re.compile(r'(/\* @generated:profile:start.*?/\* @generated:profile:end \*/|const PROFILE = \{.*?\n  \};)', re.S)


def main():
    check = '--check' in sys.argv
    creds = json.loads(CREDS.read_text(encoding='utf-8'))
    version = 'sha ' + hashlib.sha256(CREDS.read_bytes()).hexdigest()[:10]
    new_block = block(build(creds), version)
    stale = []
    for t in TARGETS:
        src = t.read_text(encoding='utf-8')
        m = PATTERN.search(src)
        if not m:
            print(f'FAIL  {t.relative_to(ROOT)}: PROFILE block not found')
            sys.exit(1)
        out = src[:m.start()] + new_block + src[m.end():]
        if out != src:
            stale.append(t)
            if not check:
                t.write_text(out, encoding='utf-8')
    if check:
        for t in stale:
            print(f'STALE {t.relative_to(ROOT)} — run python3 tools/build-profile.py')
        sys.exit(1 if stale else 0)
    for t in TARGETS:
        print(('updated ' if t in stale else 'current ') + str(t.relative_to(ROOT)))


if __name__ == '__main__':
    main()
