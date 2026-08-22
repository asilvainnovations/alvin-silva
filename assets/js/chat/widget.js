/**
 * chat/widget.js — floating chat surface.
 *
 * Renders into either a floating launcher (default) or a supplied container
 * (used by chat.html for the full-page surface), so the two chat surfaces
 * named in the README are now one implementation with two mount modes.
 *
 * No API key UI, because there is no API. See chat/engine.js.
 */
(function (root) {
  'use strict';

  const NS = (root.ASilva = root.ASilva || {});
  if (NS.chatWidget) return;
  const { el, renderInline, escapeHtml, storage, ready, bus } = NS.util;

  const STATE_KEY = 'asilva:chat:v2';
  /* Resolve against the script's own location so personal-resilience/*.html
     gets the right path without ../ juggling. */
  const LOGO = (function () {
    const base = (document.currentScript && document.currentScript.src) ||
      (Array.from(document.scripts).find((x) => /chat\/widget\.js/.test(x.src)) || {}).src || '';
    return base ? base.replace(/assets\/js\/chat\/widget\.js.*$/, 'assets/logo-192.png')
                : 'assets/logo-192.png';
  })();
  const MAX_TURNS = 60;

  const CSS = `
.asx-fab{position:fixed;right:20px;bottom:20px;z-index:9998;width:56px;height:56px;border-radius:50%;
 border:1px solid var(--line,rgba(0,0,0,.15));background:var(--card,#fff);color:var(--accent,#0069a8);cursor:pointer;
 display:grid;place-items:center;box-shadow:0 8px 28px rgba(0,0,0,.24);transition:transform .18s ease}
.asx-fab:hover{transform:translateY(-2px)}
.asx-fab:focus-visible{outline:3px solid var(--accent,#0069a8);outline-offset:3px}
.asx-fab svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.asx-fab .asx-dot{position:absolute;top:2px;right:2px;width:12px;height:12px;border-radius:50%;
 background:var(--gold,#c9a227);border:2px solid var(--card,#fff)}
.asx-panel{position:fixed;right:20px;bottom:88px;z-index:9999;width:min(400px,calc(100vw - 32px));
 height:min(590px,calc(100vh - 130px));display:flex;flex-direction:column;overflow:hidden;
 background:var(--card,#fff);color:var(--text,#111);border:1px solid var(--line,rgba(0,0,0,.15));
 border-radius:var(--radius,14px);box-shadow:0 24px 64px rgba(0,0,0,.3);
 opacity:0;transform:translateY(10px) scale(.985);pointer-events:none;transition:opacity .2s,transform .2s}
.asx-panel[data-open="true"]{opacity:1;transform:none;pointer-events:auto}
.asx-panel[data-mode="inline"]{position:static;width:100%;height:100%;min-height:520px;opacity:1;
 transform:none;pointer-events:auto;box-shadow:none}
.asx-head{display:flex;align-items:center;gap:10px;padding:12px 14px;
 border-bottom:1px solid var(--line,rgba(0,0,0,.12));background:var(--glass-strong,transparent)}
.asx-head h2{margin:0;font-size:.95rem;font-weight:650;letter-spacing:-.01em}
.asx-head p{margin:1px 0 0;font-size:.72rem;color:var(--text-3,#667);line-height:1.3}
.asx-avatar{width:34px;height:34px;border-radius:9px;flex:0 0 auto;object-fit:contain;
 background:var(--card,#fff);border:1px solid var(--line,rgba(0,0,0,.12))}
.asx-avatar-fb{display:grid;place-items:center;background:var(--accent,#0069a8);color:#fff;
 font-weight:700;font-size:.8rem;border:0}
.asx-fab-logo{width:30px;height:30px;object-fit:contain;border-radius:7px;background:#fff;padding:2px}
.asx-x{margin-left:auto;background:none;border:0;color:var(--text-3,#667);cursor:pointer;font-size:1.3rem;
 line-height:1;padding:4px 8px;border-radius:8px}
.asx-x:hover{background:var(--accent-soft,rgba(0,0,0,.06));color:var(--text,#111)}
.asx-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
.asx-msg{max-width:88%;padding:10px 13px;border-radius:13px;font-size:.875rem;line-height:1.55;
 word-wrap:break-word;overflow-wrap:anywhere}
.asx-msg a{color:var(--link,#0052cc);text-decoration:underline}
.asx-msg strong{font-weight:650}
.asx-bot{align-self:flex-start;background:var(--glass,rgba(0,0,0,.05));
 border:1px solid var(--line,rgba(0,0,0,.1));border-bottom-left-radius:4px}
.asx-user{align-self:flex-end;background:var(--accent,#0069a8);color:#fff;border-bottom-right-radius:4px}
.asx-user a{color:#fff}
.asx-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}
.asx-chip{font:inherit;font-size:.76rem;padding:6px 11px;border-radius:999px;cursor:pointer;
 background:transparent;color:var(--accent,#0069a8);border:1px solid var(--line,rgba(0,0,0,.2));
 transition:background .15s}
.asx-chip:hover{background:var(--accent-soft,rgba(0,0,0,.06))}
.asx-chip:focus-visible{outline:2px solid var(--accent,#0069a8);outline-offset:2px}
.asx-foot{border-top:1px solid var(--line,rgba(0,0,0,.12));padding:10px;display:flex;gap:8px;align-items:flex-end}
.asx-in{flex:1;resize:none;max-height:110px;min-height:40px;padding:10px 12px;font:inherit;font-size:.875rem;
 border-radius:10px;border:1px solid var(--line,rgba(0,0,0,.2));background:var(--card,#fff);color:var(--text,#111)}
.asx-in:focus{outline:2px solid var(--accent,#0069a8);outline-offset:-1px;border-color:transparent}
.asx-send{flex:0 0 auto;width:40px;height:40px;border-radius:10px;border:0;cursor:pointer;
 background:var(--accent,#0069a8);color:#fff;display:grid;place-items:center}
.asx-send:disabled{opacity:.45;cursor:not-allowed}
.asx-send svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.asx-meta{padding:0 14px 9px;font-size:.66rem;color:var(--text-3,#667);text-align:center;line-height:1.4}
.asx-typing{display:inline-flex;gap:3px;align-items:center}
.asx-typing i{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.4;
 animation:asxb 1.2s infinite}
.asx-typing i:nth-child(2){animation-delay:.18s}.asx-typing i:nth-child(3){animation-delay:.36s}
@keyframes asxb{0%,60%,100%{opacity:.28;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){
  .asx-panel,.asx-fab{transition:none}.asx-typing i{animation:none}.asx-log{scroll-behavior:auto}}
@media (max-width:480px){
  .asx-panel{right:8px;left:8px;width:auto;bottom:80px;height:min(72vh,560px)}
  .asx-fab{right:14px;bottom:14px}}
`;

  function injectCSS() {
    if (document.getElementById('asx-css')) return;
    document.head.appendChild(el('style', { id: 'asx-css', text: CSS }));
  }

  const ICON_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.5-.7L3 21l1.9-5A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg>';
  const ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>';

  class Widget {
    constructor(opts = {}) {
      this.mode = opts.container ? 'inline' : 'float';
      this.container = opts.container || null;
      this.engine = null;
      this.busy = false;
      this.turns = storage.getJSON(STATE_KEY, []) || [];
    }

    async init() {
      injectCSS();
      this._build();
      try {
        this.engine = await NS.chatEngine.create();
      } catch (e) {
        console.error('[ASilva.chat] engine init failed', e);
        this._push('bot', 'The knowledge base could not load. Please reload the page, or email **alvin.silva@asilvainnovations.com** directly.');
        return this;
      }
      if (this.turns.length) this.turns.forEach((t) => this._render(t.role, t.text));
      else this._greet();
      bus.emit('chat:ready', this);
      return this;
    }

    _greet() {
      const r = this.engine.respond('hello');
      this._push('bot', r.text);
      this._chips(r.chips || this.engine.suggestions());
    }

    _build() {
      const persona = document.documentElement.dataset.persona || storage.get('as-persona', '') || '';

      this.log = el('div', {
        class: 'asx-log', role: 'log', 'aria-live': 'polite',
        'aria-label': 'Conversation', tabindex: '0'
      });
      this.chipBar = el('div', { class: 'asx-chips' });
      this.input = el('textarea', {
        class: 'asx-in', rows: '1', placeholder: 'Ask about his work…',
        'aria-label': 'Type your question'
      });
      this.sendBtn = el('button', {
        class: 'asx-send', type: 'button', 'aria-label': 'Send message', html: ICON_SEND
      });

      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._submit(); }
      });
      this.input.addEventListener('input', () => {
        this.input.style.height = 'auto';
        this.input.style.height = Math.min(this.input.scrollHeight, 110) + 'px';
      });
      this.sendBtn.addEventListener('click', () => this._submit());

      const head = el('div', { class: 'asx-head' }, [
        /* Alvin's mark, not text initials. Falls back to "AS" if the asset
           404s, so the header never renders as a broken-image icon. */
        el('img', {
          class: 'asx-avatar', src: LOGO, alt: '', 'aria-hidden': 'true',
          width: '34', height: '34', loading: 'lazy', decoding: 'async',
          onerror: function () {
            const d = el('div', { class: 'asx-avatar asx-avatar-fb', text: 'AS', 'aria-hidden': 'true' });
            this.replaceWith(d);
          }
        }),
        el('div', {}, [
          el('h2', { text: 'Ask about Alvin\u2019s work' }),
          el('p', { text: persona ? `${persona.charAt(0).toUpperCase() + persona.slice(1)} lens \u00b7 verified record` : 'Answers from the verified record' })
        ])
      ]);

      if (this.mode === 'float') {
        this.closeBtn = el('button', {
          class: 'asx-x', type: 'button', 'aria-label': 'Close chat', html: '&times;'
        });
        this.closeBtn.addEventListener('click', () => this.close());
        head.appendChild(this.closeBtn);
      }

      this.panel = el('div', {
        class: 'asx-panel', role: 'dialog', 'aria-modal': 'false',
        'aria-label': 'Assistant', dataset: { open: String(this.mode === 'inline'), mode: this.mode }
      }, [
        head, this.log, this.chipBar,
        el('div', { class: 'asx-foot' }, [this.input, this.sendBtn]),
        el('div', {
          class: 'asx-meta',
          html: 'Runs entirely in your browser \u00b7 no AI generation \u00b7 ' +
                'answers drawn from a verified credentials record'
        })
      ]);

      if (this.mode === 'inline') {
        this.container.appendChild(this.panel);
        return;
      }

      this.fab = el('button', {
        class: 'asx-fab', type: 'button', 'aria-label': 'Open assistant',
        'aria-expanded': 'false',
        html: `<img class="asx-fab-logo" src="${LOGO}" alt="" aria-hidden="true" width="30" height="30">`
              + '<span class="asx-dot"></span>'
      });
      /* If the logo fails to load, fall back to the chat glyph rather than
         leaving an empty circular button. */
      const fabImg = this.fab.querySelector('.asx-fab-logo');
      if (fabImg) fabImg.addEventListener('error', () => {
        fabImg.outerHTML = ICON_CHAT;
      });
      this.fab.addEventListener('click', () => this.toggle());
      document.body.append(this.panel, this.fab);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) this.close();
      });
    }

    /* ------------------------------------------------------------- messaging */

    _render(role, text) {
      const node = el('div', {
        class: `asx-msg ${role === 'user' ? 'asx-user' : 'asx-bot'}`,
        /* User text is escaped; bot text is authored and passes through the
           restricted inline renderer (bold + links + breaks only). */
        html: role === 'user' ? escapeHtml(text) : renderInline(text)
      });
      this.log.appendChild(node);
      this.log.scrollTop = this.log.scrollHeight;
      return node;
    }

    _push(role, text) {
      this._render(role, text);
      this.turns.push({ role, text });
      if (this.turns.length > MAX_TURNS) this.turns.splice(0, this.turns.length - MAX_TURNS);
      storage.setJSON(STATE_KEY, this.turns);
    }

    _chips(list) {
      this.chipBar.textContent = '';
      (list || []).slice(0, 4).forEach((label) => {
        const c = el('button', { class: 'asx-chip', type: 'button', text: label });
        c.addEventListener('click', () => { this.ask(label); });
        this.chipBar.appendChild(c);
      });
    }

    _submit() {
      const v = this.input.value.trim();
      if (!v || this.busy) return;
      this.input.value = '';
      this.input.style.height = 'auto';
      this.ask(v);
    }

    /** Public: ask a question programmatically. */
    ask(question) {
      if (this.busy || !this.engine) return;
      this.busy = true;
      this.sendBtn.disabled = true;
      this._push('user', question);
      this.chipBar.textContent = '';

      const typing = this._render('bot', '');
      typing.innerHTML = '<span class="asx-typing"><i></i><i></i><i></i></span>';

      /* Deliberate small delay. Resolution is synchronous and instantaneous;
         a ~260ms beat keeps the exchange legible rather than jarring. */
      setTimeout(() => {
        let res;
        try {
          res = this.engine.respond(question);
        } catch (e) {
          console.error('[ASilva.chat] respond threw', e);
          res = { text: 'Something went wrong resolving that. Please try rephrasing.', chips: this.engine.suggestions() };
        }
        typing.remove();
        this._push('bot', res.text);
        this._chips(res.chips && res.chips.length ? res.chips : this.engine.suggestions());
        this.busy = false;
        this.sendBtn.disabled = false;
        bus.emit('chat:turn', { question, response: res });
      }, 260);
    }

    /* ---------------------------------------------------------------- panel */

    isOpen() { return this.panel.dataset.open === 'true'; }
    open() {
      this.panel.dataset.open = 'true';
      if (this.fab) this.fab.setAttribute('aria-expanded', 'true');
      const dot = this.fab && this.fab.querySelector('.asx-dot');
      if (dot) dot.remove();
      setTimeout(() => this.input.focus(), 120);
    }
    close() {
      this.panel.dataset.open = 'false';
      if (this.fab) { this.fab.setAttribute('aria-expanded', 'false'); this.fab.focus(); }
    }
    toggle() { this.isOpen() ? this.close() : this.open(); }

    reset() {
      this.turns = [];
      storage.remove(STATE_KEY);
      this.log.textContent = '';
      this._greet();
    }
  }

  function mount(opts) {
    const w = new Widget(opts);
    NS.chat = w;
    return w.init();
  }

  /* Auto-mount the floating widget unless the page opts out with
     <body data-asx-autoload="false"> (chat.html mounts inline instead). */
  ready(() => {
    if (document.body.dataset.asxAutoload === 'false') return;
    mount({});
  });

  NS.chatWidget = { mount, Widget, STATE_KEY };
})(window);
