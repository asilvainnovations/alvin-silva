#!/usr/bin/env python3
"""
tools/make-microsite.py — build the personal-resilience/ book microsite.

Every page is assembled from one template plus a content fragment in
personal-resilience/_src/<page>.inc, so all 16 pages share the same head,
book sub-navigation, styling (personal-resilience-shared.css + microsite.css)
and the site-wide navigation shell (../assets/js/boot.js → app-shell.js),
consistent with personal-resilience.html.

    python3 tools/make-microsite.py            # build all pages
    python3 tools/make-microsite.py --check    # exit 1 if any page is stale

To change copy, edit the fragment and re-run. To add a page, add a fragment
and an entry in PAGES. Never hand-edit personal-resilience/*.html.
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / 'personal-resilience'
SRC = DIR / '_src'
SITE = 'https://alvin-silva.asilvainnovations.com'
CHECKOUT = 'https://checkout.xendit.co/od/personaresilience-onenesspath'
OG_IMAGE = SITE + '/assets/cover-personal-resilience.jpg'

# name: (title, description, robots, fragment-or-builder)
PAGES = {
    'flipbook': ('Flipbook Preview', 'Read Chapter 1 of Personal Resilience: The Path to Oneness by Alvin Silva free, then get instant access to the complete book.', 'index'),
    'resources': ('Resources', 'Digital tools, companion guides and practice resources for Personal Resilience: The Path to Oneness.', 'index'),
    'resilienceone': ('ResilienceOne', 'ResilienceOne: a digital companion for stress management, habit building, reflection and adaptive growth.', 'index'),
    'resilient-futures': ('Resilient Futures', 'Resilient Futures: the free companion guide that extends Personal Resilience into education and public service.', 'index'),
    'the-author': ('The Author', 'About Alvin Silva, MDM — resilience consultant, DRR and climate-adaptation practitioner, and author of Personal Resilience.', 'index'),
    'faq': ('FAQ', 'Answers about Personal Resilience: The Path to Oneness, the CASE Equation, the flipbook, digital tools and support.', 'index'),
    'contact': ('Contact', 'Contact the Personal Resilience team for questions about the book, digital resources, workshops or customized services.', 'index'),
    'resilience-navigator': ('Resilience Navigator', 'Map where you stand on the CASE Equation and find your next step with the Resilience Navigator.', 'index'),
    'habit-studio': ('Resilient Habit Designer', 'Design tiny, lasting resilience habits with the B = MAP behavior model.', 'index'),
    'menu-behaviors': ('Menu of Resilient Habits', 'Sample resilient behaviors, prompts and celebrations for each dimension of the CASE Equation.', 'index'),
    'emotional-wellness-tracker': ('Emotional Wellness Tracker', 'Track daily emotions, spot patterns and triggers, and build emotional awareness with this free companion tool.', 'index'),
    'oasis': ('The Oasis', 'A curated sound and audio garden for psychosocial well-being, resilience and growth.', 'index'),
    'terms-and-conditions': ('Terms and Conditions', 'Terms of service for Personal Resilience and Cognitio+ digital products.', 'index'),
    'return-and-refund': ('Return and Refund Policy', 'Return and refund policy for Personal Resilience and Cognitio+ purchases.', 'index'),
    'welcome': ('Customer Welcome', 'Welcome and access page for customers of Personal Resilience: The Path to Oneness.', 'noindex'),
    'complete-fb': ('Complete Flipbook', 'The complete interactive edition of Personal Resilience for customers.', 'noindex'),
    'signup': ('Reader Access', 'How reader access to the complete book and tools works.', 'noindex'),
}

SUBNAV = [
    ('../personal-resilience.html', 'Overview'),
    ('flipbook.html', 'Preview'),
    ('resources.html', 'Resources'),
    ('resilienceone.html', 'ResilienceOne'),
    ('resilient-futures.html', 'Resilient Futures'),
    ('the-author.html', 'The Author'),
    ('faq.html', 'FAQ'),
    ('contact.html', 'Contact'),
]
# pages that belong under a sub-nav item for aria-current purposes
PARENT = {'resilience-navigator': 'resources', 'habit-studio': 'resources', 'menu-behaviors': 'resources',
          'oasis': 'resources', 'emotional-wellness-tracker': 'resources', 'welcome': None, 'complete-fb': 'flipbook', 'signup': None,
          'terms-and-conditions': None, 'return-and-refund': None}


def fix_links(h):
    """Legacy pages assumed they lived at the site root. Normalize once.
    Fragments are content only: behavior lives in SCRIPT below."""
    h = re.sub(r'<script\b.*?</script>', '', h, flags=re.S)
    h = h.replace('href="personal-resilience.html"', 'href="../personal-resilience.html"')
    h = h.replace('href="ebook.html"', 'href="../personal-resilience.html"')
    h = re.sub(r'(src|href)="assets/', r'\1="../assets/', h)
    h = h.replace('mailto://', 'mailto:')
    h = h.replace('“Cognitio+&quot;&quot;)', '“Cognitio+”)')
    # every external link opens safely in a new tab
    h = re.sub(r'<a href="(https?://[^"]+)"(?![^>]*target=)', r'<a href="\1" target="_blank" rel="noopener noreferrer"', h)
    return h


def hero(kicker, h1, lede, actions=''):
    return (f'<section class="page-hero"><div class="wrap hero-inner"><p class="kicker">{kicker}</p>'
            f'<h1>{h1}</h1><p>{lede}</p>{actions}</div></section>')


def legal(name, kicker, h1, lede):
    body = (SRC / f'{name}.body.inc').read_text(encoding='utf-8')
    return (hero(kicker, h1, lede) +
            f'<section class="section"><div class="wrap"><article class="pr-prose glass">{body}</article>'
            '<p class="pr-note">Questions about this policy? <a href="contact.html">Contact the team</a>.</p></div></section>')


def fragment(name):
    if name == 'terms-and-conditions':
        return legal(name, 'Legal', 'Terms and <span>Conditions</span>',
                     'The agreement that governs your use of Personal Resilience and Cognitio+ digital products and services.')
    if name == 'return-and-refund':
        return legal(name, 'Legal', 'Return and <span>Refund Policy</span>',
                     'How refunds, cancellations and returns work for Personal Resilience and Cognitio+ purchases.')
    if name == 'menu-behaviors':
        body = (SRC / 'menu-behaviors.body.inc').read_text(encoding='utf-8')
        return (hero('Companion Tool · Cognitio+', 'Menu of <span>Resilient Habits</span>',
                     'Pick a tiny behavior for each CASE dimension, anchor it to a prompt, and celebrate it — the Behavior Design way.',
                     '<div class="hero-actions"><a class="btn btn-primary" href="habit-studio.html">Open the Habit Designer</a>'
                     '<a class="btn btn-gold" href="resources.html">All Resources</a></div>') +
                f'<section class="section"><div class="wrap pr-menu">{body}</div></section>')
    return (SRC / f'{name}.inc').read_text(encoding='utf-8')


def subnav(name):
    current = PARENT.get(name, name)
    items = ''.join(
        f'<li><a href="{href}"' + (' aria-current="page"' if href == f'{current}.html' else '') + f'>{label}</a></li>'
        for href, label in SUBNAV)
    return (f'<nav class="pr-subnav" aria-label="Personal Resilience book"><div class="wrap pr-subnav-inner">'
            f'<a class="pr-subnav-brand" href="../personal-resilience.html"><img src="../assets/cover-personal-resilience.jpg" alt="" width="28" height="40">'
            f'<span>Personal Resilience<small>The Path to Oneness</small></span></a>'
            f'<ul>{items}</ul>'
            f'<a class="btn btn-gold btn-sm pr-subnav-cta" href="{CHECKOUT}" target="_blank" rel="noopener noreferrer" data-tip="Instant access through secure checkout">Get the book</a>'
            f'</div></nav>')


ENDNAV = (
    '<section class="pr-endnav" aria-label="Book policies"><div class="wrap">'
    '<p><strong>Personal Resilience: The Path to Oneness</strong> · by Alvin Silva, MDM · Cognitio+</p>'
    '<p class="pr-endnav-links"><a href="terms-and-conditions.html">Terms</a><a href="return-and-refund.html">Returns &amp; refunds</a>'
    '<a href="welcome.html">Customer welcome</a><a href="signup.html">Reader access</a>'
    '<a href="mailto:hello@cognitioplus.com">hello@cognitioplus.com</a></p></div></section>')

SCRIPT = r"""<script>
(function () {
  'use strict';
  /* FAQ accordion */
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (panel) panel.hidden = btn.getAttribute('aria-expanded') !== 'true';
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      if (panel) panel.hidden = open;
    });
  });
  /* Contact form: no backend — compose an email instead */
  var form = document.querySelector('form[data-mailto], .contact-grid form');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = new FormData(form), get = function (k) { return String(f.get(k) || '').trim(); };
    var status = form.querySelector('.form-status');
    if (!get('email') || !get('message')) { if (status) status.textContent = 'Please add your email and a message.'; return; }
    var to = get('department') === 'Sales' ? 'alvin.silva@cognitioplus.com' : 'hello@cognitioplus.com';
    var body = get('message') + '\n\n— ' + [get('first'), get('last')].join(' ').trim() +
      '\n' + get('email') + (get('phone') ? '\n' + get('phone') : '') + (get('company') ? '\n' + get('company') : '');
    if (status) status.textContent = 'Opening your email app with the message pre-filled…';
    location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(get('subject') || 'Personal Resilience inquiry') + '&body=' + encodeURIComponent(body);
  });
})();
</script>"""


def page(name):
    title, desc, robots = PAGES[name]
    full = f'{title} | Personal Resilience — The Path to Oneness'
    canon = f'{SITE}/personal-resilience/{name}'
    robots_v = 'index, follow, max-image-preview:large' if robots == 'index' else 'noindex, follow'
    e = html.escape
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<!-- GENERATED by tools/make-microsite.py from personal-resilience/_src/ — do not edit by hand -->
<title>{e(full)}</title>
<meta name="description" content="{e(desc)}">
<meta name="author" content="Alvin M. Silva, MDM">
<meta name="robots" content="{robots_v}">
<link rel="canonical" href="{canon}">
<meta name="theme-color" content="#0a0e27">
<link rel="icon" type="image/png" sizes="32x32" href="../assets/logo-32.png">
<link rel="apple-touch-icon" href="../assets/logo-180.png">
<link rel="manifest" href="../manifest.webmanifest">
<meta property="og:type" content="book">
<meta property="og:site_name" content="Personal Resilience — Alvin Silva">
<meta property="og:url" content="{canon}">
<meta property="og:title" content="{e(full)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{OG_IMAGE}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Poppins:wght@300;400;500;600&family=Roboto+Condensed:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="personal-resilience-shared.css">
<link rel="stylesheet" href="microsite.css">
<link rel="stylesheet" href="../assets/css/app-shell.css">
</head>
<body data-microsite="personal-resilience" data-page="{name}">
<a href="#main" class="skip-link">Skip to main content</a>
{subnav(name)}
<main id="main" class="page-shell">
{fix_links(fragment(name)).strip()}
</main>
{ENDNAV}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
{SCRIPT}
<script src="../assets/js/boot.js" defer></script>
</body>
</html>
"""


def main():
    check = '--check' in sys.argv
    stale = []
    for name in PAGES:
        out = DIR / f'{name}.html'
        html_out = page(name)
        if check:
            if not out.exists() or out.read_text(encoding='utf-8') != html_out:
                stale.append(name)
        else:
            out.write_text(html_out, encoding='utf-8')
            print(f'  built personal-resilience/{name}.html  {len(html_out):>7,} bytes')
    if check:
        if stale:
            print('stale microsite pages (run tools/make-microsite.py):', ', '.join(stale))
            sys.exit(1)
        print(f'microsite up to date ({len(PAGES)} pages)')


if __name__ == '__main__':
    main()
