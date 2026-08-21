#!/usr/bin/env python3
"""
tools/make-pages.py — compose new pages from the index.html shell.

Rather than hand-writing four new pages and letting them drift from the
design system, this extracts the real <style>, icon sprite, header, mobile
menu, and footer out of index.html and reuses them verbatim. Re-run it after
a design change to regenerate the secondary pages.

    python3 tools/make-pages.py
"""
import re, sys, os, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = (ROOT / "index.html").read_text(encoding="utf-8")


def between(pattern_open, pattern_close, text=SRC, inclusive=True):
    o = re.search(pattern_open, text)
    if not o:
        sys.exit(f"! could not locate {pattern_open!r} in index.html")
    c = re.search(pattern_close, text[o.end():])
    if not c:
        sys.exit(f"! could not locate {pattern_close!r} after {pattern_open!r}")
    start = o.start() if inclusive else o.end()
    end = o.end() + (c.end() if inclusive else c.start())
    return text[start:end]


# --- harvest the shell -------------------------------------------------------
STYLE  = between(r"<style>", r"</style>")
SPRITE = between(r'<svg width="0" height="0" style="position:absolute"', r"</svg>")
HEADER = between(r'<header class="site-header">', r"</header>")
MOBNAV = between(r'<div class="overlay" id="overlay">', r"</nav>")
FOOTER = between(r'<footer class="site-footer">', r"</footer>")

# Scripts at the end of index.html carry the theme toggle, persona engine,
# mobile-menu wiring, accessibility toolbar and cookie consent. Reuse them all.
SCRIPTS = "".join(re.findall(r"<script>.*?</script>", SRC, re.S))


def head(title, desc, canon, extra=""):
    return f"""<!DOCTYPE html>
<html lang="en" data-persona="executive">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="author" content="Alvin M. Silva, MDM">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="{canon}">

<meta name="theme-color" content="#0a0e27">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="A. Silva">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="assets/logo-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="assets/logo-192.png">
<link rel="apple-touch-icon" href="assets/logo-180.png">

<meta property="og:type" content="website">
<meta property="og:site_name" content="A. Silva Innovations">
<meta property="og:url" content="{canon}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://alvin-silva.asilvainnovations.com/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
{extra}
<style>{STYLE[len('<style>'):-len('</style>')]}</style>
</head>"""


def page(title, desc, canon, main_html, *, extra_head="", body_attrs="", extra_css=""):
    return f"""{head(title, desc, canon, extra_head)}
<body{(' ' + body_attrs) if body_attrs else ''}>
<a href="#main" class="skip-link">Skip to main content</a>

{SPRITE}

{HEADER}

{MOBNAV}

<main id="main">
{main_html}
</main>

{FOOTER}

{extra_css}
{SCRIPTS}
<script src="assets/js/boot.js" defer></script>
</body>
</html>
"""


# --- shared styling for the new modules -------------------------------------
MODULE_CSS = """<style>
/* Blog + Chorus module styling — extends the existing token system,
   introduces no new colors of its own. */
.blog-grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(290px,1fr))}
.blog-card{padding:20px;border-radius:var(--radius);border:1px solid var(--line);
 display:flex;flex-direction:column;gap:8px;transition:transform .2s ease,border-color .2s ease}
.blog-card:hover{transform:translateY(-3px);border-color:var(--accent)}
.blog-card h3{margin:0;font-size:1.06rem;line-height:1.35;letter-spacing:-.015em}
.blog-card h3 a{color:var(--text);text-decoration:none}
.blog-card h3 a:hover{color:var(--accent)}
.blog-card-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;
 font-size:.74rem;color:var(--text-3);margin:0}
.blog-tag{padding:2px 9px;border-radius:999px;border:1px solid var(--line);
 background:var(--accent-soft);color:var(--accent);font-size:.68rem;letter-spacing:.02em}
.blog-excerpt{margin:0;font-size:.9rem;line-height:1.6;color:var(--text-2)}
.blog-read{font-size:.72rem;color:var(--text-3);margin-top:auto}
.blog-more{margin-top:18px}
.blog-more a{color:var(--link);font-weight:600}
.blog-status{color:var(--text-3);padding:26px 0}
.blog-post{max-width:72ch;margin:0 auto}
.blog-post h1{font-size:clamp(1.7rem,4vw,2.5rem);line-height:1.15;letter-spacing:-.025em;margin:0 0 10px}
.blog-lede{font-size:1.06rem;line-height:1.65;color:var(--text-2);
 padding-bottom:16px;border-bottom:1px solid var(--divider)}
.blog-body{font-size:1rem;line-height:1.75;color:var(--text-2)}
.blog-body h2{font-size:1.32rem;margin:2em 0 .5em;color:var(--text);letter-spacing:-.015em}
.blog-body h3{font-size:1.09rem;margin:1.6em 0 .4em;color:var(--text)}
.blog-body p{margin:0 0 1.1em}
.blog-body ul{margin:0 0 1.2em;padding-left:1.3em}
.blog-body li{margin-bottom:.55em}
.blog-body blockquote{margin:1.6em 0;padding:2px 0 2px 20px;
 border-left:3px solid var(--accent);color:var(--text)}
.blog-body blockquote p{margin:0 0 .3em;font-size:1.06rem;font-style:italic}
.blog-body blockquote cite{font-size:.8rem;color:var(--text-3);font-style:normal}
.blog-body figure{margin:1.8em 0}
.blog-body figure img{width:100%;border-radius:var(--radius);border:1px solid var(--line)}
.blog-body figcaption{font-size:.78rem;color:var(--text-3);margin-top:8px;text-align:center}
.blog-callout{margin:1.6em 0;padding:15px 18px;border-radius:var(--radius);
 border:1px solid var(--line-gold);background:var(--accent-soft);font-size:.93rem;line-height:1.65}
.blog-back{margin:0 0 14px}
.blog-back a{color:var(--text-3);font-size:.84rem;text-decoration:none}
.blog-back a:hover{color:var(--accent)}
.chat-shell{max-width:860px;margin:0 auto;height:min(70vh,640px)}
</style>"""

# --- blog.html ---------------------------------------------------------------
blog_main = """<section class="section">
  <div class="wrap">
    <p class="kicker">Writing</p>
    <h2 class="section-title">Notes from <span class="hl">practice</span></h2>
    <p class="section-lede">Short pieces on systems thinking, evaluation, and the
      unglamorous mechanics of getting development work to actually land.</p>
    <div data-asilva-blog></div>
  </div>
</section>"""

# --- chorus.html -------------------------------------------------------------
chorus_main = """<section class="section">
  <div class="wrap">
    <p class="kicker">AI-Chorus</p>
    <h2 class="section-title">One question, <span class="hl">every lens</span></h2>
    <p class="section-lede">Ask once and see how the same verified record reads to a
      government counterpart, a humanitarian partner, a private client, and an
      academic reviewer. Retrieval only &mdash; nothing here is generated.</p>
    <div data-asilva-chorus></div>
  </div>
</section>"""

# --- chat.html ---------------------------------------------------------------
chat_main = """<section class="section">
  <div class="wrap">
    <p class="kicker">Assistant</p>
    <h2 class="section-title">Ask about <span class="hl">the work</span></h2>
    <p class="section-lede">This assistant answers from Alvin&rsquo;s structured credentials
      record. It runs entirely in your browser &mdash; no API key, no server, no text
      generation, and nothing you type leaves this page.</p>
    <div class="chat-shell glass" data-asilva-chat></div>
  </div>
</section>"""

# --- 404.html ----------------------------------------------------------------
notfound_main = """<section class="section">
  <div class="wrap" style="text-align:center;padding-block:clamp(40px,9vw,90px)">
    <p class="kicker">Error 404</p>
    <h2 class="section-title" style="font-size:clamp(2.4rem,7vw,4rem)">
      This page <span class="hl">doesn&rsquo;t exist</span></h2>
    <p class="section-lede" style="margin-inline:auto;max-width:52ch">
      The link may be out of date, or the address slightly off. Nothing is broken on
      your end.</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:26px">
      <a class="btn btn-primary" href="index.html">Back to home</a>
      <a class="btn btn-ghost" href="portfolio.html">Browse the portfolio</a>
      <a class="btn btn-ghost" href="blog.html">Read the writing</a>
    </div>
    <p style="margin-top:30px;font-size:.86rem;color:var(--text-3)">
      Looking for something specific? The assistant in the corner can point you at it.</p>
  </div>
</section>"""

PAGES = [
    ("blog.html", "Writing — Alvin M. Silva, MDM",
     "Notes on systems thinking, evaluation practice, and development management from Alvin M. Silva, MDM.",
     "https://alvin-silva.asilvainnovations.com/blog.html", blog_main, ""),
    ("chorus.html", "AI-Chorus — Alvin M. Silva, MDM",
     "Ask one question and see how Alvin Silva's verified record reads across government, humanitarian, private-sector, and academic lenses.",
     "https://alvin-silva.asilvainnovations.com/chorus.html", chorus_main, ""),
    ("chat.html", "Assistant — Alvin M. Silva, MDM",
     "A browser-side assistant answering from Alvin Silva's verified credentials record. No AI generation, no data leaves your browser.",
     "https://alvin-silva.asilvainnovations.com/chat.html", chat_main,
     'data-asx-autoload="false"'),
    ("404.html", "Page not found — Alvin M. Silva, MDM",
     "The page you requested could not be found.",
     "https://alvin-silva.asilvainnovations.com/404.html", notfound_main, ""),
]

written = []
for name, title, desc, canon, main_html, body_attrs in PAGES:
    extra_head = ('<meta name="robots" content="noindex, follow">'
                  if name == "404.html" else "")
    html = page(title, desc, canon, main_html,
                extra_head=extra_head, body_attrs=body_attrs,
                extra_css=MODULE_CSS)
    (ROOT / name).write_text(html, encoding="utf-8")
    written.append((name, len(html)))

# chat.html mounts the widget inline rather than as a floating launcher
chat = (ROOT / "chat.html").read_text(encoding="utf-8")
chat = chat.replace(
    '<script src="assets/js/boot.js" defer></script>',
    '<script src="assets/js/boot.js" defer></script>\n'
    '<script>\n'
    '  /* chat.html renders the assistant inline (full-surface) instead of as a\n'
    '     floating launcher. Same Widget class, same engine — one implementation,\n'
    '     two mount modes. */\n'
    '  window.addEventListener("load", function () {\n'
    '    var host = document.querySelector("[data-asilva-chat]");\n'
    '    if (host && window.ASilva && window.ASilva.chatWidget) {\n'
    '      window.ASilva.chatWidget.mount({ container: host });\n'
    '    }\n'
    '  });\n'
    '</script>')
(ROOT / "chat.html").write_text(chat, encoding="utf-8")

print("Generated from the index.html shell:")
for n, sz in written:
    print(f"  {n:<14} {sz:>7,} bytes")
print(f"\nShell parts reused: style={len(STYLE):,}  sprite={len(SPRITE):,}  "
      f"header={len(HEADER):,}  mobnav={len(MOBNAV):,}  footer={len(FOOTER):,}  "
      f"scripts={len(SCRIPTS):,}")
