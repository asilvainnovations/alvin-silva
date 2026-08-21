/**
 * modules/ai-chorus.js — AI-Chorus
 *
 * ⚠ SPEC PENDING — READ BEFORE EXTENDING
 * "AI-Chorus" appears in the roadmap but not in README.md, and no spec for it
 * exists anywhere in this repo. Rather than guess silently, this module ships
 * as a *working* implementation of the most defensible reading, clearly
 * labelled, with the swap points marked:
 *
 *   Working assumption — a chorus is the same question answered through
 *   several persona lenses at once, so a visitor can see how the same record
 *   reads to a donor, a government counterpart, an academic, and a private
 *   client side by side. It reuses the existing persona engine and the
 *   internal retrieval engine; no new intelligence, no generation.
 *
 * If that is not what AI-Chorus means, replace `voices()` and `ask()` below.
 * The registration block, mount contract, and styling stay valid regardless —
 * that is what makes this a plug-in point rather than a rewrite.
 *
 * Mount: [data-asilva-chorus]
 * Route: #/chorus
 */
(function (root) {
  'use strict';

  const NS = (root.ASilva = root.ASilva || {});
  const { el, renderInline, escapeHtml } = NS.util;

  /* ---- SWAP POINT 1: which lenses participate in a chorus ---- */
  const VOICES = [
    { id: 'government',  label: 'Government',   blurb: 'Policy and mandate framing' },
    { id: 'humanitarian', label: 'Humanitarian', blurb: 'Field and community framing' },
    { id: 'private',     label: 'Private sector', blurb: 'Delivery and ROI framing' },
    { id: 'academic',    label: 'Academic',     blurb: 'Method and evidence framing' }
  ];

  const CSS = `
.chorus-ask{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
.chorus-ask input{flex:1;min-width:220px;padding:11px 14px;font:inherit;border-radius:10px;
 border:1px solid var(--line,rgba(0,0,0,.2));background:var(--card,#fff);color:var(--text,#111)}
.chorus-ask button{padding:11px 20px;border:0;border-radius:10px;cursor:pointer;font:inherit;
 font-weight:600;background:var(--accent,#0069a8);color:#fff}
.chorus-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.chorus-voice{padding:16px;border-radius:var(--radius,14px);border:1px solid var(--line,rgba(0,0,0,.14));
 background:var(--glass,rgba(0,0,0,.03))}
.chorus-voice h3{margin:0 0 2px;font-size:.9rem;letter-spacing:-.01em}
.chorus-voice .chorus-blurb{margin:0 0 10px;font-size:.72rem;color:var(--text-3,#667)}
.chorus-voice .chorus-a{font-size:.86rem;line-height:1.6}
.chorus-voice .chorus-a a{color:var(--link,#0052cc)}
.chorus-note{margin-top:16px;font-size:.74rem;color:var(--text-3,#667);line-height:1.5}
`;

  function injectCSS() {
    if (document.getElementById('chorus-css')) return;
    document.head.appendChild(el('style', { id: 'chorus-css', text: CSS }));
  }

  async function setup(ctx) {
    injectCSS();
    const mount = ctx.mountEl;

    /* One engine, queried once per lens. The engine is deterministic, so a
       chorus is reproducible — same question, same four answers, every time. */
    const engine = await NS.chatEngine.create();

    const input = el('input', {
      type: 'text', placeholder: 'Ask one question, hear every lens\u2026',
      'aria-label': 'Question for all perspectives'
    });
    const go = el('button', { type: 'button', text: 'Ask all' });
    const grid = el('div', { class: 'chorus-grid' });

    /* ---- SWAP POINT 2: how a single voice produces its answer ---- */
    function ask(question) {
      const previous = document.documentElement.dataset.persona;
      grid.textContent = '';
      VOICES.forEach((v) => {
        /* Set the lens, resolve, restore. engine.js reads persona off the
           document (see LENSES / activeLens there) and uses it to rank
           retrieval and frame multi-item answers, so each voice genuinely
           differs. NOTE: until 2026-08-21 the engine ignored persona entirely
           and this loop produced four identical columns. */
        document.documentElement.dataset.persona = v.id;
        let res;
        try { res = engine.respond(question); }
        catch (e) { res = { text: 'This lens could not answer.' }; }

        grid.appendChild(el('div', { class: 'chorus-voice' }, [
          el('h3', { text: v.label }),
          el('p', { class: 'chorus-blurb', text: v.blurb }),
          el('div', { class: 'chorus-a', html: renderInline(res.text) })
        ]));
      });
      if (previous) document.documentElement.dataset.persona = previous;
      else delete document.documentElement.dataset.persona;
      NS.util.bus.emit('chorus:asked', { question });
    }

    go.addEventListener('click', () => { if (input.value.trim()) ask(input.value.trim()); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) ask(input.value.trim());
    });

    mount.textContent = '';
    mount.append(
      el('div', { class: 'chorus-ask' }, [input, go]),
      grid,
      el('p', {
        class: 'chorus-note',
        html: 'Every answer is retrieved from the same verified credentials record \u2014 ' +
              'only the framing differs. No text is generated.'
      })
    );

    if (NS.router) NS.router.on('/chorus', () => mount.scrollIntoView({ behavior: 'smooth' }));

    return { ask, voices: () => VOICES.slice() };
  }

  NS.registry.define({
    id: 'ai-chorus',
    version: '0.1.0-draft',   // draft until the real spec lands
    requires: ['util', 'chatEngine'],
    mount: '[data-asilva-chorus]',
    routes: ['/chorus'],
    nav: { label: 'AI-Chorus', href: 'chorus.html', order: 50 },
    setup
  });
})(window);
