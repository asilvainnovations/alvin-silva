/**
 * app-shell.js — the one navigation shell for every user-facing page.
 *
 * Loaded first by boot.js. It renders, from a single information
 * architecture (IA) below:
 *   - the top header (brand + desktop group menus + utilities)
 *   - the mobile bottom bar (Home · Work · Knowledge · Tools · More)
 *   - one reusable sheet (bottom sheet on mobile, popover on desktop)
 *   - the compact footer (identity + legal only)
 *   - the PWA install experience
 *   - progressive-disclosure helpers ([data-disclose-list])
 *
 * Pages own their content; the shell owns navigation. To add, rename, or
 * move a destination, edit IA — never page markup.
 *
 * Page contract (all optional):
 *   <body data-shell-page="work">       force the active group
 *   <body data-shell="off">             opt a page out (e.g. book microsites)
 *   #personaModal + window.ASilvaOpenPersona   enables the "Tailor" control
 *   #a11yFab                             enables "Accessibility tools"
 *   #consentBanner                       "Cookie settings" opens it in-page
 */
(function (root) {
  'use strict';
  if (root.ASilvaShell) return;
  const doc = root.document;
  if (doc.body && doc.body.dataset.shell === 'off') return;

  /* ---------------------------------------------------------------
     BASE — resolve the site root from this script's own URL so links
     work from nested pages, Vercel clean URLs, and file://.
     --------------------------------------------------------------- */
  const SELF = doc.currentScript && doc.currentScript.src;
  const BASE = SELF ? SELF.replace(/assets\/js\/core\/app-shell\.js.*$/, '') : '';
  const url = (p) => (/^(https?:|mailto:|tel:)/.test(p) ? p : BASE + p);

  /* ---------------------------------------------------------------
     INFORMATION ARCHITECTURE — the single source for navigation.
     Every internal href below is verified by tools/validate-shell.py.
     audience: 'public' | 'operator' (operator = Alvin's private
     career workspace; hidden from visitors unless operator mode is on).
     --------------------------------------------------------------- */
  const IA = {
    home: { label: 'Home', icon: 'home', href: 'index.html' },
    /* Direct destinations: header links on desktop, top of the mobile
       Menu sheet, and the footer icon bar. Order is the visitor's order. */
    primary: [
      { id: 'portfolio', label: 'Portfolio', desc: 'Platforms, consulting engagements, and reports', href: 'portfolio.html', icon: 'grid' },
      { id: 'blog', label: 'Blog', desc: 'Notes on systems thinking, evaluation, and resilience', href: 'blog.html', icon: 'pen' },
      { id: 'faq', label: 'FAQ', desc: 'How engagements, fees, and delivery work', href: 'index.html#faq', icon: 'help' },
      { id: 'contact', label: 'Contact', desc: 'Replies within one business day', href: 'index.html#contact', icon: 'mail' },
      { id: 'chat', label: 'Chat', desc: 'Ask the assistant, answered from the verified record', href: 'chat.html', icon: 'chat' }
    ],
    /* Header dropdown for "Portfolio" (the grouped-menu style Alvin prefers). */
    work: {
      label: 'Portfolio', head: 'The Work', items: [
        { label: 'Full portfolio', desc: 'Platforms, consulting engagements, and reports', href: 'portfolio.html', icon: 'grid' },
        { label: 'Track record', desc: 'Flagship engagements, newest first', href: 'index.html#impact', icon: 'flag' },
        { label: 'Capabilities', desc: 'Seven disciplines, one systems view', href: 'index.html#expertise', icon: 'layers' },
        { label: 'Books & platforms', desc: 'Intellectual property that outlasts engagements', href: 'index.html#works', icon: 'book' },
        { label: 'About Alvin', desc: 'Profile and proof', href: 'index.html#about-detail', icon: 'user' }
      ]
    },
    social: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/alvinsilva777', icon: 'in' },
      { label: 'Facebook', href: 'https://www.facebook.com/a7vinsi7va', icon: 'fb' },
      { label: 'Email', href: 'mailto:alvin.silva@asilvainnovations.com', icon: 'mail' },
      { label: 'DigiCon card', href: 'https://digicon.cards', icon: 'card' }
    ],
    groups: [
      {
        id: 'tools', label: 'Tools', icon: 'tools', head: 'Interactive Tools',
        title: 'Tools', lede: 'Interactive tools that answer from Alvin’s verified record.',
        sections: [
          { items: [
            { label: 'Ask the assistant', desc: 'Questions answered from verified credentials', href: 'chat.html', icon: 'chat' },
            { label: 'AI-Chorus', desc: 'One question, read through five audience lenses', href: 'chorus.html', icon: 'chorus' },
            { label: 'Support center', desc: 'Engagements, documents, and services', href: 'support.html', icon: 'help' },
            { label: 'Book flipbook preview', desc: 'Read Chapter 1 of Personal Resilience', href: 'personal-resilience/flipbook.html', icon: 'book' },
            { label: 'BIRD platform', desc: 'Bangsamoro Investment Roadmap 2026–2035', href: 'https://bangsamro-investment-roadmapp.asilvainnovations.com', icon: 'layers', external: true }
          ] },
          { heading: 'Career workspace', audience: 'operator', items: [
            { label: 'Opportunity scanner', desc: 'Score a posting, pick a CV, draft the letter', href: 'career-automation.html', icon: 'target' },
            { label: 'Form assistant', desc: 'Install the browser helper for portals', href: 'form-assistant-setup.html', icon: 'form' },
            { label: 'Personal Data Sheet', desc: 'CS Form 212, revised 2025', href: 'pds.html', icon: 'file' },
            { label: 'Blog composer', desc: 'Draft and export posts to assets/data/blog', href: 'tools/blog-composer.html', icon: 'pen' }
          ] }
        ]
      },
      {
        id: 'more', label: 'Menu', icon: 'menu',
        title: 'Menu', lede: '',
        sections: [
          { heading: 'Explore', kind: 'primary' },
          { heading: 'Books', items: [
            { label: 'Personal Resilience', desc: 'Book, 2025: the path to oneness', href: 'personal-resilience.html', icon: 'book' },
            { label: 'Building Resilience', desc: 'Book, 2023: a more fulfilling life', href: 'building-resilience.html', icon: 'book' }
          ] },
          { heading: 'Connect', items: [
            { label: 'About Alvin', desc: '', href: 'index.html#about-detail', icon: 'user' },
            { label: 'Track record', desc: 'Flagship engagements, newest first', href: 'index.html#impact', icon: 'flag' },
            { label: 'LinkedIn', desc: '', href: 'https://www.linkedin.com/in/alvinsilva777', icon: 'in', external: true },
            { label: 'DigiCon card', desc: '', href: 'https://digicon.cards', icon: 'card', external: true }
          ] },
          { heading: 'Preferences', kind: 'prefs' },
          { heading: 'Policies', compact: true, items: [
            { label: 'Policies overview', href: 'policies.html' },
            { label: 'Privacy', href: 'privacy-policy.html' },
            { label: 'Cookies', href: 'cookie-policy.html' },
            { label: 'Terms', href: 'terms-of-services.html' },
            { label: 'Accessibility', href: 'accessibility-policy.html' }
          ] }
        ]
      }
    ],
    cta: { label: 'Start a Conversation', href: 'index.html#contact' },
    contact: {
      email: 'alvin.silva@asilvainnovations.com',
      phone: '+639178555134', phoneLabel: '+63 917 855 5134',
      vcard: 'assets/contact.vcf'
    },
    /* Which nav destination each page belongs to (filename -> id). */
    pages: {
      'index': 'home', '': 'home',
      'portfolio': 'portfolio',
      'blog': 'blog',
      'chat': 'chat',
      'personal-resilience': 'more', 'building-resilience': 'more',
      'chorus': 'tools', 'support': 'tools', 'career-automation': 'tools',
      'form-assistant-setup': 'tools', 'pds': 'tools', 'blog-composer': 'tools',
      'policies': 'more', 'privacy-policy': 'more', 'cookie-policy': 'more',
      'terms-of-services': 'more', 'accessibility-policy': 'more', '404': 'more'
    },
    /* 'operator' keeps the career workspace out of visitors' menus.
       Switch to 'public' to show it to everyone. */
    careerVisibility: 'operator'
  };

  /* ---------------------------------------------------------------
     ICONS — self-contained sprite so every page renders identically.
     --------------------------------------------------------------- */
  const ICON_PATHS = {
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    work: '<rect x="3.5" y="7" width="17" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
    book: '<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5V19"/>',
    tools: '<path d="M14.5 6.5a4 4 0 0 0 5 5l-8.5 8.5a2.1 2.1 0 0 1-3-3z"/><path d="M5 4l3 3M4 8l4-4"/>',
    more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    layers: '<path d="m12 4 8 4-8 4-8-4z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/>',
    cap: '<path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.5 3.5 2 5.5 2s4-.5 5.5-2V11"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8h.01"/>',
    chat: '<path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5z"/>',
    chorus: '<path d="M4 15v-6M8 18V6M12 15v-6M16 19V5M20 15v-6"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    form: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    file: '<path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5"/>',
    user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c0-3.8 3.4-6 7.5-6s7.5 2.2 7.5 6"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
    in: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M8 10.5V16M8 7.8v.01M11.5 16v-3.2c0-1.4.9-2.3 2.1-2.3s2 .9 2 2.3V16M11.5 10.5V16"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.8 16c.5-1.3 1.5-2 2.7-2s2.2.7 2.7 2M14 10h4M14 13.5h3"/>',
    ext: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M10 5.5H6A1.5 1.5 0 0 0 4.5 7v11A1.5 1.5 0 0 0 6 19.5h11a1.5 1.5 0 0 0 1.5-1.5v-4"/>',
    chev: '<path d="m7 10 5 5 5-5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    install: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7.5v7m-3-3 3 3 3-3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.2M12 19v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.8 12H5M19 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"/>',
    moon: '<path d="M20 13.3A8 8 0 1 1 10.7 4a6.3 6.3 0 0 0 9.3 9.3z"/>',
    a11y: '<circle cx="12" cy="5" r="2"/><path d="M4.5 9.2c2.5.7 5 1 7.5 1s5-.3 7.5-1M12 10.2v5.3m0 0-3.3 5.5m3.3-5.5 3.3 5.5"/>',
    lens: '<circle cx="8.5" cy="12" r="4.5"/><circle cx="15.5" cy="12" r="4.5"/>',
    cookie: '<path d="M20.5 12.5A8.5 8.5 0 1 1 11.5 3.5a3 3 0 0 0 4 3.5 3 3 0 0 0 5 5.5z"/><path d="M8.5 10.5h.01M11 15h.01M15.5 14.5h.01"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    share: '<path d="M12 15V3.5m-4 4 4-4 4 4"/><path d="M7 10.5H5.5v10h13v-10H17"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    swap: '<path d="M7 4v13m0 0-3.5-3.5M7 17l3.5-3.5M17 20V7m0 0 3.5 3.5M17 7l-3.5 3.5"/>',
    fb: '<path d="M14 8.5h2.5V5H14a3.5 3.5 0 0 0-3.5 3.5V11H8v3.5h2.5V21H14v-6.5h2.5L17 11h-3V9a.5.5 0 0 1 .5-.5z"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/>'
  };
  function icon(name, cls) {
    return '<svg class="' + (cls || 'shl-ico') + '" aria-hidden="true" focusable="false"><use href="#shl-' + name + '"/></svg>';
  }
  function sprite() {
    const syms = Object.keys(ICON_PATHS).map(function (k) {
      return '<symbol id="shl-' + k + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICON_PATHS[k] + '</symbol>';
    }).join('');
    const holder = doc.createElement('div');
    holder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">' + syms + '</svg>';
    doc.body.insertBefore(holder.firstChild, doc.body.firstChild);
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k) { try { return root.localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { root.localStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { root.localStorage.removeItem(k); } catch (_) {} }
  };

  /* ---------------------------------------------------------------
     CONTEXT — current page, group, operator mode
     --------------------------------------------------------------- */
  const pageKey = (function () {
    const p = root.location.pathname.replace(/\/+$/, '');
    const last = p.split('/').pop() || '';
    return decodeURIComponent(last).replace(/\.html?$/, '');
  })();
  const currentGroup = (doc.body && doc.body.dataset.shellPage) || IA.pages[pageKey] || null;

  (function operatorFromUrl() {
    const q = new URLSearchParams(root.location.search).get('operator');
    if (q === 'on') store.set('as-operator', '1');
    if (q === 'off') store.del('as-operator');
  })();
  const operatorPages = ['career-automation', 'form-assistant-setup', 'pds', 'blog-composer'];
  const operatorMode = IA.careerVisibility === 'public' ||
    store.get('as-operator') === '1' || operatorPages.indexOf(pageKey) !== -1;

  function isCurrent(href) {
    if (/^https?:/.test(href)) return false;
    const [file, hash] = href.split('#');
    const key = file.split('/').pop().replace(/\.html?$/, '');
    if (hash) return false; /* in-page anchors are never "the page" */
    return key === pageKey || (key === 'index' && pageKey === '');
  }

  /* ---------------------------------------------------------------
     THEME — shared by every page (key compatible with legacy code)
     --------------------------------------------------------------- */
  const THEME_KEY = 'as-theme';
  function currentTheme() { return doc.documentElement.dataset.theme || 'dark'; }
  function applyTheme(t) {
    doc.documentElement.dataset.theme = t;
    store.set(THEME_KEY, t);
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#f4f6fb' : '#0a0e27');
    requestAnimationFrame(matchPageTone);
    doc.querySelectorAll('[data-shl-action="theme"]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(t === 'light'));
      b.setAttribute('aria-label', t === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
      const lbl = b.querySelector('.shl-theme-label');
      if (lbl) lbl.textContent = t === 'light' ? 'Theme: Light' : 'Theme: Dark';
    });
  }
  /* Some pages only ship a dark design and ignore data-theme. Match the
     shell to what the page really renders, judged by its text color. */
  function matchPageTone() {
    const m = (getComputedStyle(doc.body).color || '').match(/\d+(\.\d+)?/g);
    let light = currentTheme() === 'light';
    if (m && m.length >= 3) {
      const lum = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
      light = lum < 0.5; /* dark text means a light page */
    }
    doc.documentElement.classList.toggle('shl-on-light', light);
  }
  (function initTheme() {
    const saved = store.get(THEME_KEY);
    if (saved) { doc.documentElement.dataset.theme = saved; return; }
    if (!doc.documentElement.dataset.theme) {
      const light = root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches;
      doc.documentElement.dataset.theme = light ? 'light' : 'dark';
    }
  })();

  /* ---------------------------------------------------------------
     INSTALL MANAGER — beforeinstallprompt, iOS guidance, back-off
     --------------------------------------------------------------- */
  const Install = (function () {
    const DISMISS_KEY = 'as-install-dismissed-at';
    const COUNT_KEY = 'as-install-dismiss-count';
    const INSTALLED_KEY = 'as-installed';
    const BACKOFF_DAYS = 21;
    const MAX_DISMISSALS = 3;
    let deferred = null;

    const ua = root.navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (root.navigator.platform === 'MacIntel' && root.navigator.maxTouchPoints > 1);
    const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    function standalone() {
      return (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) ||
        root.navigator.standalone === true;
    }
    function installed() { return standalone() || store.get(INSTALLED_KEY) === '1'; }
    function promptable() { return !!deferred; }
    function supported() { return promptable() || isIOSSafari; }

    function suppressed() {
      if (store.get('as-install-dismissed')) return true; /* legacy banner choice */
      const n = +(store.get(COUNT_KEY) || 0);
      if (n >= MAX_DISMISSALS) return true;
      const at = +(store.get(DISMISS_KEY) || 0);
      return at && (Date.now() - at) < BACKOFF_DAYS * 864e5;
    }

    root.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      root.deferredPrompt = e; /* legacy callers */
      refreshInstallEntries();
      maybeOffer();
    });
    root.addEventListener('appinstalled', function () {
      deferred = null; root.deferredPrompt = null;
      store.set(INSTALLED_KEY, '1');
      hideCard();
      refreshInstallEntries();
      toast('Installed. Open it from your home screen.');
    });

    async function install() {
      if (installed()) { toast('Already installed on this device.'); return; }
      if (deferred) {
        hideCard();
        deferred.prompt();
        const choice = await deferred.userChoice.catch(function () { return {}; });
        deferred = null; root.deferredPrompt = null;
        if (choice && choice.outcome === 'dismissed') dismiss();
        refreshInstallEntries();
        return;
      }
      openSheet('install');
    }
    function dismiss() {
      store.set(DISMISS_KEY, String(Date.now()));
      store.set(COUNT_KEY, String(+(store.get(COUNT_KEY) || 0) + 1));
      hideCard();
    }

    /* Offer only after real engagement: a second page in the session,
       40 seconds on the page, or half the page read. */
    let engaged = false;
    function markEngaged() { if (engaged) return; engaged = true; maybeOffer(); }
    function trackEngagement() {
      let views = 0;
      try { views = +(root.sessionStorage.getItem('as-pv') || 0) + 1; root.sessionStorage.setItem('as-pv', String(views)); } catch (_) {}
      if (views >= 2) engaged = true;
      setTimeout(markEngaged, 40000);
      const onScroll = function () {
        const h = doc.documentElement.scrollHeight - root.innerHeight;
        if (h > 0 && root.scrollY / h > 0.5) { root.removeEventListener('scroll', onScroll); markEngaged(); }
      };
      root.addEventListener('scroll', onScroll, { passive: true });
    }
    function maybeOffer() {
      if (!engaged || installed() || suppressed() || !supported()) return;
      if (doc.querySelector('.shl-sheet.is-open, .persona-modal.show, .consent-banner.show')) {
        setTimeout(maybeOffer, 8000); return;
      }
      showCard();
    }

    let card = null;
    function showCard() {
      if (card) return;
      card = doc.createElement('div');
      card.className = 'shl-install';
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', 'Install this app');
      card.innerHTML =
        '<img src="' + url('assets/logo-192.png') + '" alt="" width="40" height="40">' +
        '<div class="shl-install-text"><p class="shl-install-title">Install Alvin Silva Platform</p>' +
        '<p class="shl-install-body">' + esc(installCopy()) + '</p></div>' +
        '<div class="shl-install-actions">' +
        '<button type="button" class="shl-btn shl-btn-primary" data-shl-action="install">' + (promptable() ? 'Install' : 'Show me how') + '</button>' +
        '<button type="button" class="shl-btn shl-btn-quiet" data-shl-action="install-dismiss">Not now</button></div>';
      doc.body.appendChild(card);
      requestAnimationFrame(function () { card.classList.add('is-in'); });
    }
    function hideCard() {
      if (!card) return;
      const c = card; card = null;
      c.classList.remove('is-in');
      setTimeout(function () { c.remove(); }, 300);
    }

    return { install: install, dismiss: dismiss, installed: installed, promptable: promptable,
      supported: supported, isIOS: isIOS, isIOSSafari: isIOSSafari, trackEngagement: trackEngagement };
  })();

  function installCopy() {
    return operatorMode
      ? 'Access your professional knowledge, tools, career resources, and applications from your home screen.'
      : 'Open Alvin\u2019s work, writing, and tools from your home screen, including offline.';
  }

  let personaLabel = null;
  /* Legacy controls captured before the shell replaces the old chrome.
     Pages not yet migrated still bind their own listeners to these;
     clicking a detached element still runs those listeners. */
  const legacy = {};
  function captureLegacy() {
    legacy.cookies = doc.getElementById('cookieSettings');
    legacy.persona = doc.getElementById('personaPill');
  }

  /* ---------------------------------------------------------------
     RENDER — header, bottom bar, footer
     --------------------------------------------------------------- */
  const groupsById = {};
  IA.groups.forEach(function (g) { groupsById[g.id] = g; });
  const hasPersona = function () {
    if (!doc.getElementById('personaModal')) return false;
    return typeof root.ASilvaOpenPersona === 'function' || !!legacy.persona;
  };

  function primaryCurrent(it) {
    return it.id === currentGroup || isCurrent(it.href);
  }

  function dropHTML(id, label, head, items, current) {
    return '<li class="shl-drop" data-shl-drop>' +
      '<button type="button" class="shl-topnav-btn" aria-expanded="false" aria-controls="shlDrop-' + id + '"' +
        (current ? ' aria-current="page"' : '') + '>' + esc(label) + icon('chev', 'shl-chev') + '</button>' +
      '<div class="shl-drop-menu" id="shlDrop-' + id + '" hidden>' +
        '<div class="shl-drop-head">' + esc(head) + '</div>' +
        items.map(function (it) {
          const ext = !!it.external;
          return '<a class="shl-drop-item" href="' + esc(url(it.href)) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') +
            (isCurrent(it.href) ? ' aria-current="page"' : '') + '>' + icon(it.icon, 'shl-ico') +
            '<span><span class="shl-drop-label">' + esc(it.label) + (ext ? ' ↗<span class="shl-sr"> (opens in a new tab)</span>' : '') + '</span>' +
            (it.desc ? '<span class="shl-drop-desc">' + esc(it.desc) + '</span>' : '') + '</span></a>';
        }).join('') +
      '</div></li>';
  }
  function toolItems() {
    const out = [];
    groupsById.tools.sections.forEach(function (sec) {
      if (sec.audience === 'operator' && !operatorMode) return;
      sec.items.forEach(function (it) { out.push(it); });
    });
    return out;
  }

  function renderHeader() {
    const old = doc.querySelector('.site-header');
    const header = doc.createElement('header');
    header.className = 'shl-header';
    const byId = {}; IA.primary.forEach(function (it) { byId[it.id] = it; });
    const plain = ['blog', 'faq', 'contact', 'chat'].map(function (id) {
      const it = byId[id];
      return '<li><a class="shl-topnav-link" href="' + esc(url(it.href)) + '"' + (primaryCurrent(it) ? ' aria-current="page"' : '') + '>' + esc(it.label) + '</a></li>';
    }).join('');
    header.innerHTML =
      '<div class="shl-header-inner">' +
        '<a class="shl-brand" href="' + url(IA.home.href) + '" aria-label="Alvin M. Silva, home">' +
          '<img src="' + url('assets/logo-192.png') + '" alt="" width="46" height="46">' +
          '<span class="shl-brand-text"><span class="shl-brand-name">ALVIN M. SILVA</span>' +
          '<span class="shl-brand-sub">MDM · Resilience · Systems Innovation</span></span>' +
        '</a>' +
        '<nav class="shl-topnav" aria-label="Main navigation"><ul>' +
          dropHTML('work', IA.work.label, IA.work.head, IA.work.items, currentGroup === 'portfolio') +
          plain +
          dropHTML('tools', 'Tools', groupsById.tools.head, toolItems(), currentGroup === 'tools') +
        '</ul></nav>' +
        '<div class="shl-utils">' +
          (hasPersona() ? '<button type="button" class="shl-pill" data-shl-action="persona" aria-label="Change audience profile" data-tip="Tailor this site to your role — copy, proof points, and next steps re-rank">' + icon('swap') + '<span class="shl-pill-label" data-shl-persona-label>Tailor</span></button>' : '') +
          '<button type="button" class="shl-iconbtn shl-desktop-only" data-shl-action="theme" aria-pressed="false">' + icon('moon', 'shl-ico shl-ico-moon') + icon('sun', 'shl-ico shl-ico-sun') + '</button>' +
          '<a class="shl-btn shl-btn-cta shl-desktop-only" href="' + url(IA.cta.href) + '" data-tip="Describe the outcome you’re accountable for — reply within one business day">' + esc(IA.cta.label) + '</a>' +
          '<button type="button" class="shl-menubtn" data-shl-drawer aria-expanded="false" aria-controls="shlDrawer" aria-label="Open navigation menu">' +
            '<span></span><span></span><span></span></button>' +
        '</div>' +
      '</div>';
    const skip = doc.querySelector('body > .skip-link, body > a[href="#main"]');
    if (old) old.remove();
    if (skip) skip.insertAdjacentElement('afterend', header);
    else doc.body.insertBefore(header, doc.body.firstChild);
    ['mobileMenu', 'overlay', 'mobileAppNav'].forEach(function (id) {
      const n = doc.getElementById(id); if (n) n.remove();
    });
  }

  /* ---------- header dropdowns ---------- */
  function closeDrops(except) {
    doc.querySelectorAll('[data-shl-drop]').forEach(function (d) {
      if (d === except) return;
      const b = d.querySelector('button'), m = d.querySelector('.shl-drop-menu');
      if (b.getAttribute('aria-expanded') === 'true') { b.setAttribute('aria-expanded', 'false'); m.hidden = true; d.classList.remove('is-open'); }
    });
  }
  function toggleDrop(d, focusFirst) {
    const b = d.querySelector('button'), m = d.querySelector('.shl-drop-menu');
    const open = b.getAttribute('aria-expanded') !== 'true';
    closeDrops(d);
    b.setAttribute('aria-expanded', String(open)); m.hidden = !open; d.classList.toggle('is-open', open);
    if (open && focusFirst) { const f = m.querySelector('a'); if (f) f.focus(); }
  }
  function dropKeys(e) {
    const d = e.target.closest && e.target.closest('[data-shl-drop]');
    if (!d) return;
    const items = [].slice.call(d.querySelectorAll('.shl-drop-item'));
    const i = items.indexOf(doc.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); if (d.querySelector('button').getAttribute('aria-expanded') !== 'true') toggleDrop(d, true); else (items[i + 1] || items[0]).focus(); }
    else if (e.key === 'ArrowUp' && i > -1) { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
    else if (e.key === 'Escape') { closeDrops(); d.querySelector('button').focus(); }
  }

  /* ---------- mobile drawer (slide-in, grouped, with "Viewing as") ---------- */
  let drawer, overlay, drawerTrigger = null;
  const PERSONAS = [['executive', 'Executive', 'user'], ['government', 'Government', 'home'], ['humanitarian', 'NGO & Humanitarian', 'star'],
    ['private', 'Private Sector', 'work'], ['academic', 'Academia', 'cap']];
  function drawerLink(it) {
    const ext = !!it.external;
    return '<a class="shl-mm-link" href="' + esc(url(it.href)) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') +
      (isCurrent(it.href) ? ' aria-current="page"' : '') + '>' + icon(it.icon) + '<span>' + esc(it.label) + (ext ? ' ↗' : '') + '</span></a>';
  }
  function buildDrawer() {
    overlay = doc.createElement('div'); overlay.className = 'shl-overlay'; overlay.hidden = true;
    drawer = doc.createElement('nav');
    drawer.className = 'shl-drawer'; drawer.id = 'shlDrawer'; drawer.setAttribute('aria-label', 'Mobile navigation'); drawer.hidden = true;
    const pol = groupsById.more.sections.filter(function (x) { return x.heading === 'Policies'; })[0].items;
    drawer.innerHTML =
      '<div class="shl-mm-head"><img src="' + url('assets/logo-192.png') + '" alt="" width="52" height="52">' +
        '<button type="button" class="shl-mm-close" data-shl-drawer-close aria-label="Close menu">' + icon('close') + '</button></div>' +
      '<div class="shl-mm-group"><div class="shl-mm-title">Navigate</div>' + [IA.home].concat(IA.primary).map(drawerLink).join('') + '</div>' +
      '<div class="shl-mm-group"><div class="shl-mm-title">The Work</div>' + IA.work.items.slice(1).map(drawerLink).join('') + '</div>' +
      '<div class="shl-mm-group"><div class="shl-mm-title">Tools</div>' + toolItems().map(drawerLink).join('') + '</div>' +
      '<div class="shl-mm-group"><div class="shl-mm-title">Connect</div>' +
        IA.social.map(function (x) { return drawerLink({ label: x.label, href: x.href, icon: x.icon, external: /^https?:/.test(x.href) }); }).join('') + '</div>' +
      (typeof root.ASilvaSetPersona === 'function' ?
        '<div class="shl-mm-persona"><div class="shl-mm-title">Viewing as</div>' + PERSONAS.map(function (p) {
          return '<button type="button" class="shl-chip" data-shl-persona="' + p[0] + '" aria-pressed="false">' + icon(p[2]) + esc(p[1]) + '</button>';
        }).join('') + '</div>' : '') +
      '<div class="shl-mm-group shl-mm-prefs"><div class="shl-mm-title">Preferences</div>' + prefsHTML() + '</div>' +
      '<p class="shl-compact shl-mm-legal">' + pol.map(function (i) { return '<a href="' + esc(url(i.href)) + '">' + esc(i.label) + '</a>'; }).join('') + '</p>';
    doc.body.appendChild(overlay); doc.body.appendChild(drawer);
  }
  function syncPersonaChips() {
    const cur = doc.documentElement.dataset.persona;
    doc.querySelectorAll('[data-shl-persona]').forEach(function (c) {
      const on = c.dataset.shlPersona === cur;
      c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on));
    });
  }
  function openDrawer(trigger) {
    drawerTrigger = trigger || doc.activeElement;
    drawer.hidden = false; overlay.hidden = false;
    applyTheme(currentTheme()); syncPersonaChips();
    doc.documentElement.classList.add('shl-locked');
    doc.querySelectorAll('[data-shl-drawer]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-label', 'Close navigation menu'); });
    requestAnimationFrame(function () {
      drawer.classList.add('is-open'); overlay.classList.add('is-open');
      const f = drawer.querySelector('.shl-mm-link'); if (f) f.focus({ preventScroll: true });
    });
  }
  function closeDrawer(instant) {
    if (drawer.hidden) return;
    drawer.classList.remove('is-open'); overlay.classList.remove('is-open');
    doc.documentElement.classList.remove('shl-locked');
    doc.querySelectorAll('[data-shl-drawer]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', 'Open navigation menu'); });
    const done = function () { drawer.hidden = true; overlay.hidden = true; };
    if (instant) done(); else setTimeout(done, 260);
    if (drawerTrigger && drawerTrigger.focus && !instant) drawerTrigger.focus({ preventScroll: true });
  }
  function drawerTrap(e) {
    if (drawer.hidden || e.key !== 'Tab') return;
    const f = [].slice.call(drawer.querySelectorAll('a[href], button:not([disabled])'));
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- footer: icon bar, brand + socials, Navigate / Flagship / Credentials ---------- */
  function renderFooter() {
    const old = doc.querySelector('footer.site-footer, footer.footer, body > footer');
    const f = doc.createElement('footer');
    f.className = 'shl-footer';
    const year = new Date().getFullYear();
    const pol = groupsById.more.sections.filter(function (s) { return s.heading === 'Policies'; })[0].items;
    const tile = function (it) {
      return '<li><a class="shl-ftile" href="' + esc(url(it.href)) + '"' + (primaryCurrent(it) ? ' aria-current="page"' : '') + '>' +
        '<span class="shl-ftile-ico">' + icon(it.icon) + '</span><span>' + esc(it.label) + '</span></a></li>';
    };
    f.innerHTML =
      '<div class="shl-footer-inner">' +
        '<nav class="shl-fbar" aria-label="Footer quick links"><ul>' + IA.primary.map(tile).join('') +
          '<li><button type="button" class="shl-ftile" data-shl-open="tools" aria-haspopup="dialog" aria-expanded="false">' +
          '<span class="shl-ftile-ico">' + icon('tools') + '</span><span>Tools</span></button></li></ul></nav>' +
        '<div class="shl-fgrid">' +
          '<div class="shl-fbrand">' +
            '<a class="shl-brand" href="' + url(IA.home.href) + '"><img src="' + url('assets/logo-192.png') + '" alt="" width="46" height="46">' +
            '<span class="shl-brand-text"><span class="shl-brand-name">ALVIN M. SILVA</span><span class="shl-brand-sub">A. Silva Innovations</span></span></a>' +
            '<p class="shl-fbrand-copy">Development management professional, systems innovator, and certified international humanitarian practitioner — co-creating policies and solutions for growth and sustainability.</p>' +
            '<div class="shl-socials">' + IA.social.map(function (x) {
              const ext = /^https?:/.test(x.href);
              return '<a href="' + esc(x.href) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + ' aria-label="' + esc(x.label) + '" data-tip="' + esc(x.label) + '">' + icon(x.icon) + '</a>';
            }).join('') + '</div>' +
          '</div>' +
          '<div class="shl-fcol"><h2 class="shl-fhead">Navigate</h2><ul>' +
            [IA.home].concat(IA.primary).map(function (it) { return '<li><a href="' + esc(url(it.href)) + '">' + esc(it.label) + '</a></li>'; }).join('') + '</ul></div>' +
          '<div class="shl-fcol"><h2 class="shl-fhead">Flagship Work</h2><ul data-shl-flagship>' + FLAGSHIP_FALLBACK + '</ul></div>' +
          '<div class="shl-fcol"><h2 class="shl-fhead">Credentials</h2><ul data-shl-credentials>' + CRED_FALLBACK + '</ul></div>' +
        '</div>' +
        '<div class="shl-flegal">' +
          '<p class="shl-footer-id">© ' + year + ' Alvin M. Silva, MDM · A. Silva Innovations. All rights reserved.</p>' +
          '<p class="shl-footer-links">' + pol.map(function (i) { return '<a href="' + url(i.href) + '">' + esc(i.label) + '</a>'; }).join('') +
            '<button type="button" class="shl-linkbtn" data-shl-action="cookies">Cookie settings</button>' +
            '<button type="button" class="shl-linkbtn" data-shl-action="top">' + icon('up', 'shl-ico shl-fico') + 'Back to top</button></p>' +
          '<span class="shl-pwa-badge">' + icon('install') + 'Installable PWA · Works offline</span>' +
        '</div>' +
      '</div>';
    if (old) old.replaceWith(f); else doc.body.appendChild(f);
  }

  /* ---------- credentials.json → footer columns (single source of truth) ---------- */
  const li = function (href, text) { return '<li><a href="' + esc(url(href)) + '">' + esc(text) + '</a></li>'; };
  const FLAGSHIP_FALLBACK = li('index.html#impact', 'Ormoc City EOC & CDRRMO Manual of Operations') + li('index.html#impact', 'BIRD 2026–2035') +
    li('index.html#impact', 'TESDA Strategic Plan 2026–2030') + li('portfolio.html', 'DDRiVE-M Platform') + li('portfolio.html', 'Cognitio+');
  const CRED_FALLBACK = li('index.html#about-detail', 'MDM — Asian Institute of Management') + li('index.html#numbers', '18+ years · 15+ countries') +
    li('index.html#books', 'Published author ×5') + li('portfolio.html', 'NRCP Associate Member (DOST)');
  const FLAGSHIP_ORDER = ['BIRD 2026–2035', 'TESDA Strategic Plan 2026–2030', 'Balatan Climate Resilience Hub', 'DDRiVE-M Platform', 'Cognitio+'];
  const PLATFORMS = /DDRiVE|Strat Planner|RTL|Cognitio\+|Toolkit/;
  function loadCredentials() {
    if (!root.fetch) return;
    root.fetch(url('credentials.json'), { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.profile) return;
      root.ASilvaCredentials = d;
      const P = d.profile, projects = d.projects || [];
      const picks = projects.filter(function (p) { return p.status === 'ongoing'; })
        .concat(FLAGSHIP_ORDER.map(function (n) { return projects.filter(function (p) { return p.name === n; })[0]; }).filter(Boolean))
        .filter(function (p, i, a) { return a.indexOf(p) === i; }).slice(0, 5);
      const fl = doc.querySelector('[data-shl-flagship]');
      if (fl && picks.length) fl.innerHTML = picks.map(function (p) {
        return li(PLATFORMS.test(p.name) ? 'portfolio.html' : 'index.html#impact', p.name + (p.status === 'ongoing' ? ' (ongoing)' : ''));
      }).join('');
      const degree = (P.degrees && P.degrees[0] || '').replace(/^(MDM)\s*[—-]\s*Master in Development Management,\s*/, '$1 — ').replace(/,\s*\d{4}$/, '');
      const active = (d.certifications || []).filter(function (c) { return c.status !== 'expired'; }).length;
      const mem = (d.memberships || [])[0];
      const cr = doc.querySelector('[data-shl-credentials]');
      if (cr) cr.innerHTML =
        (degree ? li('index.html#about-detail', degree) : '') +
        li('index.html#numbers', P.years_total + '+ years · ' + P.countries + '+ countries') +
        li('index.html#books', 'Published author ×' + P.books_published) +
        (active ? li('portfolio.html', active + ' current certifications') : '') +
        (mem ? li('portfolio.html', 'NRCP ' + mem.name + ' (DOST)') : '');
      root.dispatchEvent(new CustomEvent('as:credentials', { detail: d }));
    }).catch(function () { /* footer keeps its fallback copy */ });
  }

  /* ---------------------------------------------------------------
     SHEET — one component: bottom sheet (mobile) / popover (desktop)
     --------------------------------------------------------------- */
  let sheet, backdrop, sheetBody, sheetTitle, lastTrigger = null, openId = null;

  function buildSheet() {
    backdrop = doc.createElement('div');
    backdrop.className = 'shl-backdrop';
    backdrop.hidden = true;
    sheet = doc.createElement('div');
    sheet.className = 'shl-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'shlSheetTitle');
    sheet.hidden = true;
    sheet.innerHTML =
      '<div class="shl-sheet-grip" aria-hidden="true"></div>' +
      '<div class="shl-sheet-head"><h2 id="shlSheetTitle" class="shl-sheet-title"></h2>' +
      '<button type="button" class="shl-iconbtn" data-shl-action="close" aria-label="Close">' + icon('close') + '</button></div>' +
      '<div class="shl-sheet-body"></div>';
    doc.body.appendChild(backdrop);
    doc.body.appendChild(sheet);
    sheetBody = sheet.querySelector('.shl-sheet-body');
    sheetTitle = sheet.querySelector('.shl-sheet-title');
  }

  function itemHTML(it) {
    const cur = isCurrent(it.href);
    const ext = !!it.external;
    return '<li><a class="shl-item" href="' + esc(url(it.href)) + '"' +
      (ext ? ' target="_blank" rel="noopener noreferrer"' : '') +
      (cur ? ' aria-current="page"' : '') + '>' +
      (it.icon ? '<span class="shl-item-ico">' + icon(it.icon) + '</span>' : '') +
      '<span class="shl-item-text"><span class="shl-item-label">' + esc(it.label) +
      (ext ? '<span class="shl-sr"> (opens in a new tab)</span>' + icon('ext', 'shl-ext') : '') + '</span>' +
      (it.desc ? '<span class="shl-item-desc">' + esc(it.desc) + '</span>' : '') +
      '</span></a></li>';
  }

  function prefsHTML() {
    const rows = [];
    if (!Install.installed()) {
      rows.push('<li><button type="button" class="shl-item" data-shl-action="install">' +
        '<span class="shl-item-ico">' + icon('install') + '</span><span class="shl-item-text">' +
        '<span class="shl-item-label">Install app</span><span class="shl-item-desc">Home-screen access, works offline</span></span></button></li>');
    }
    rows.push('<li><button type="button" class="shl-item" data-shl-action="theme" aria-pressed="false">' +
      '<span class="shl-item-ico">' + icon('moon', 'shl-ico shl-ico-moon') + icon('sun', 'shl-ico shl-ico-sun') + '</span>' +
      '<span class="shl-item-text"><span class="shl-item-label shl-theme-label">Theme</span><span class="shl-item-desc">Switch light or dark</span></span></button></li>');
    if (hasPersona()) {
      rows.push('<li><button type="button" class="shl-item" data-shl-action="persona">' +
        '<span class="shl-item-ico">' + icon('lens') + '</span><span class="shl-item-text">' +
        '<span class="shl-item-label">Tailor to my role</span><span class="shl-item-desc" data-shl-persona-desc>Reorder the site for your sector</span></span></button></li>');
    }
    if (doc.getElementById('a11yFab')) {
      rows.push('<li><button type="button" class="shl-item" data-shl-action="a11y">' +
        '<span class="shl-item-ico">' + icon('a11y') + '</span><span class="shl-item-text">' +
        '<span class="shl-item-label">Accessibility tools</span><span class="shl-item-desc">Text size, contrast, read aloud</span></span></button></li>');
    }
    rows.push('<li><button type="button" class="shl-item" data-shl-action="cookies">' +
      '<span class="shl-item-ico">' + icon('cookie') + '</span><span class="shl-item-text">' +
      '<span class="shl-item-label">Cookie settings</span></span></button></li>');
    return '<ul class="shl-list">' + rows.join('') + '</ul>';
  }

  function groupHTML(g) {
    let html = g.lede ? '<p class="shl-sheet-lede">' + esc(g.lede) + '</p>' : '';
    g.sections.forEach(function (s) {
      if (s.audience === 'operator' && !operatorMode) return;
      html += '<section class="shl-group' + (s.audience === 'operator' ? ' is-operator' : '') + '">';
      if (s.heading) {
        html += '<h3 class="shl-group-title">' + esc(s.heading) +
          (s.audience === 'operator' ? ' <span class="shl-tag">' + icon('lock', 'shl-tag-ico') + 'Private</span>' : '') + '</h3>';
      }
      if (s.kind === 'prefs') html += prefsHTML();
      else if (s.kind === 'primary') html += '<ul class="shl-list">' +
        [IA.home].concat(IA.primary).map(itemHTML).join('') +
        '<li><button type="button" class="shl-item" data-shl-open="tools"><span class="shl-item-ico">' + icon('tools') +
        '</span><span class="shl-item-text"><span class="shl-item-label">Tools</span><span class="shl-item-desc">Assistant, AI-Chorus, support, and platforms</span></span></button></li></ul>';
      else if (s.compact) html += '<p class="shl-compact">' + s.items.map(function (i) {
        return '<a href="' + esc(url(i.href)) + '"' + (isCurrent(i.href) ? ' aria-current="page"' : '') + '>' + esc(i.label) + '</a>';
      }).join('') + '</p>';
      else html += '<ul class="shl-list">' + s.items.map(itemHTML).join('') + '</ul>';
      html += '</section>';
    });
    return html;
  }

  function installGuideHTML() {
    let steps;
    if (Install.isIOSSafari) {
      steps = '<ol class="shl-steps"><li>Tap ' + icon('share', 'shl-inline-ico') + ' <strong>Share</strong> in the Safari toolbar.</li>' +
        '<li>Choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></ol>';
    } else if (Install.isIOS) {
      steps = '<p class="shl-sheet-lede">On iPhone and iPad, installing works from Safari. Open this page in Safari, then use Share \u2192 Add to Home Screen.</p>';
    } else {
      steps = '<p class="shl-sheet-lede">Your browser hasn\u2019t offered an install option for this visit. Look for <strong>Install</strong> or <strong>Add to Home screen</strong> in the browser menu or address bar. Some browsers, such as Firefox on desktop, don\u2019t install sites.</p>';
    }
    return '<p class="shl-sheet-lede">' + esc(installCopy()) + '</p>' + steps;
  }

  function openSheet(id, trigger) {
    if (openId === id) { closeSheet(); return; }
    if (openId) closeSheet(true);
    const g = groupsById[id];
    sheetTitle.textContent = id === 'install' ? 'Install Alvin Silva Platform' : g.title;
    sheetBody.innerHTML = id === 'install' ? installGuideHTML() : groupHTML(g);
    applyTheme(currentTheme());
    syncPersonaLabel();
    lastTrigger = trigger || doc.activeElement;
    openId = id;
    doc.querySelectorAll('[data-shl-open]').forEach(function (b) {
      b.setAttribute('aria-expanded', String(b.dataset.shlOpen === id));
    });

    const desktop = root.matchMedia('(min-width: 900px)').matches;
    sheet.classList.toggle('is-popover', desktop && !!trigger && trigger.classList.contains('shl-topnav-btn'));
    if (sheet.classList.contains('is-popover')) {
      const r = trigger.getBoundingClientRect();
      const w = 360;
      sheet.style.left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, root.innerWidth - w - 12)) + 'px';
      sheet.style.top = (r.bottom + 10) + 'px';
    } else {
      sheet.style.left = ''; sheet.style.top = '';
      backdrop.hidden = false;
      doc.documentElement.classList.add('shl-locked');
    }
    sheet.hidden = false;
    requestAnimationFrame(function () {
      sheet.classList.add('is-open');
      backdrop.classList.add('is-open');
      const first = sheet.querySelector('.shl-sheet-body a, .shl-sheet-body button') || sheet.querySelector('[data-shl-action="close"]');
      if (first) first.focus({ preventScroll: true });
    });
  }

  function closeSheet(instant) {
    if (!openId) return;
    openId = null;
    sheet.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    doc.documentElement.classList.remove('shl-locked');
    doc.querySelectorAll('[data-shl-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    const done = function () { if (!openId) { sheet.hidden = true; backdrop.hidden = true; } };
    if (instant) done(); else setTimeout(done, 220);
    if (lastTrigger && lastTrigger.focus && !instant) lastTrigger.focus({ preventScroll: true });
  }

  function trapFocus(e) {
    if (!openId || e.key !== 'Tab' || sheet.classList.contains('is-popover')) return;
    const f = [].slice.call(sheet.querySelectorAll('a[href], button:not([disabled])'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------------------------------------------------------------
     ACTIONS — delegated, so dynamically rendered controls just work
     --------------------------------------------------------------- */
  function onClick(e) {
    const dropBtn = e.target.closest('[data-shl-drop] > button');
    if (dropBtn) { e.preventDefault(); toggleDrop(dropBtn.parentElement, false); return; }
    if (!e.target.closest('[data-shl-drop]')) closeDrops();
    const dToggle = e.target.closest('[data-shl-drawer]');
    if (dToggle) { e.preventDefault(); if (drawer.hidden) openDrawer(dToggle); else closeDrawer(); return; }
    if (e.target.closest('[data-shl-drawer-close]')) { closeDrawer(); return; }
    const chip = e.target.closest('[data-shl-persona]');
    if (chip) {
      if (typeof root.ASilvaSetPersona === 'function') root.ASilvaSetPersona(chip.dataset.shlPersona);
      syncPersonaChips(); closeDrawer(); return;
    }
    const opener = e.target.closest('[data-shl-open]');
    if (opener) { e.preventDefault(); closeDrawer(true); openSheet(opener.dataset.shlOpen, opener); return; }

    const act = e.target.closest('[data-shl-action]');
    if (act) {
      const a = act.dataset.shlAction;
      if (a === 'close') closeSheet();
      else if (a === 'theme') applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
      else if (a === 'install') { closeSheet(true); Install.install(); }
      else if (a === 'install-dismiss') Install.dismiss();
      else if (a === 'top') root.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      else if (a === 'persona') {
        closeSheet(true); closeDrawer(true);
        if (typeof root.ASilvaOpenPersona === 'function') root.ASilvaOpenPersona();
        else if (legacy.persona) legacy.persona.click();
      }
      else if (a === 'a11y') { closeSheet(true); closeDrawer(true); const fab = doc.getElementById('a11yFab'); if (fab) fab.click(); }
      else if (a === 'cookies') {
        closeSheet(true); closeDrawer(true);
        if (legacy.cookies) legacy.cookies.click();
        else if (doc.getElementById('consentBanner')) root.dispatchEvent(new CustomEvent('as:cookie-settings'));
        else root.location.href = url('cookie-policy.html');
      }
      return;
    }

    /* In-page anchors chosen from a menu: close first, then scroll. */
    const link = e.target.closest('.shl-sheet a[href], .shl-drawer a[href], .shl-drop-menu a[href]');
    if (link) {
      const u = new URL(link.href, root.location.href);
      if (u.pathname === root.location.pathname && u.hash) {
        const target = doc.getElementById(decodeURIComponent(u.hash.slice(1)));
        if (target) {
          e.preventDefault(); closeSheet(true); closeDrawer(true); closeDrops();
          target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
          history.replaceState(null, '', u.hash);
          target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true });
        }
      } else { closeSheet(true); closeDrawer(true); closeDrops(); }
      return;
    }

    if (openId && sheet.classList.contains('is-popover') && !e.target.closest('.shl-sheet')) closeSheet(true);
  }
  function reduced() { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------------------------------------------------------------
     PERSONA LABEL — mirrors the page's persona system, if any
     --------------------------------------------------------------- */
  function syncPersonaLabel() {
    if (!personaLabel) return;
    doc.querySelectorAll('[data-shl-persona-label]').forEach(function (n) { n.textContent = personaLabel; });
    doc.querySelectorAll('[data-shl-action="persona"].shl-pill').forEach(function (n) {
      n.setAttribute('aria-label', 'Tailor this site to your role. Current lens: ' + personaLabel);
    });
    doc.querySelectorAll('[data-shl-persona-desc]').forEach(function (n) { n.textContent = 'Current lens: ' + personaLabel; });
  }
  root.addEventListener('as:persona', function (e) {
    personaLabel = e.detail && e.detail.label; syncPersonaLabel();
    if (drawer) syncPersonaChips();
  });

  /* ---------------------------------------------------------------
     PROGRESSIVE DISCLOSURE
     <div data-disclose-list="3" data-disclose-label="engagements">
     shows the first 3 children on small screens with a toggle.
     --------------------------------------------------------------- */
  function initDisclosure() {
    const mq = root.matchMedia('(max-width: 899px)');
    doc.querySelectorAll('[data-disclose-list]').forEach(function (list, idx) {
      const n = +list.dataset.discloseList || 3;
      const kids = [].slice.call(list.children);
      if (kids.length <= n) return;
      if (!list.id) list.id = 'shlList' + idx;
      const noun = list.dataset.discloseLabel || 'items';
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'shl-disclose';
      btn.setAttribute('aria-controls', list.id);
      list.insertAdjacentElement('afterend', btn);
      let open = false;
      function render() {
        const collapse = mq.matches && !open;
        kids.forEach(function (k, i) { k.classList.toggle('shl-collapsed', collapse && i >= n); });
        btn.hidden = !mq.matches;
        btn.setAttribute('aria-expanded', String(open));
        btn.innerHTML = (open ? 'Show fewer ' : 'Show all ' + kids.length + ' ') + esc(noun) + icon('chev', 'shl-chev' + (open ? ' is-up' : ''));
      }
      btn.addEventListener('click', function () {
        open = !open; render();
        if (open) { const k = kids[n]; if (k) { k.setAttribute('tabindex', '-1'); k.focus({ preventScroll: false }); } }
      });
      (mq.addEventListener ? mq.addEventListener('change', render) : mq.addListener(render));
      render();
    });
  }

  /* ---------------------------------------------------------------
     TOOLTIPS — any element with data-tip="…" gets an accessible tooltip
     on hover (mouse) and on keyboard focus. One floating node, linked
     via aria-describedby, so screen readers hear it too. Used to
     highlight the lead-generating controls across every page.
     --------------------------------------------------------------- */
  function initTips() {
    const tip = doc.createElement('div');
    tip.className = 'shl-tip'; tip.id = 'shlTip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    doc.body.appendChild(tip);
    let owner = null;
    function show(el) {
      const text = el.getAttribute('data-tip');
      if (!text) return;
      owner = el;
      tip.textContent = text; tip.hidden = false;
      const prev = el.getAttribute('aria-describedby') || '';
      if (prev.split(' ').indexOf('shlTip') === -1) el.setAttribute('aria-describedby', (prev + ' shlTip').trim());
      const r = el.getBoundingClientRect();
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let top = r.top - h - 10, below = false;
      if (top < 70) { top = r.bottom + 10; below = true; }
      const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, root.innerWidth - w - 8));
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
      tip.classList.toggle('is-below', below);
      requestAnimationFrame(function () { tip.classList.add('is-in'); });
    }
    function hide() {
      if (!owner) return;
      const d = (owner.getAttribute('aria-describedby') || '').split(' ').filter(function (x) { return x && x !== 'shlTip'; }).join(' ');
      if (d) owner.setAttribute('aria-describedby', d); else owner.removeAttribute('aria-describedby');
      owner = null; tip.classList.remove('is-in'); tip.hidden = true;
    }
    doc.addEventListener('pointerover', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const el = e.target.closest('[data-tip]');
      if (el && el !== owner) show(el); else if (!el && owner) hide();
    });
    doc.addEventListener('focusin', function (e) {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el && el.matches(':focus-visible')) show(el);
    });
    doc.addEventListener('focusout', hide);
    root.addEventListener('scroll', hide, { passive: true });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  }

  /* ---------------------------------------------------------------
     TOAST — reuse the page's #toast when present
     --------------------------------------------------------------- */
  function toast(msg) {
    let t = doc.getElementById('toast');
    if (!t) {
      t = doc.createElement('div'); t.id = 'toast'; t.className = 'toast shl-toast';
      t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
      doc.body.appendChild(t);
    }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function refreshInstallEntries() {
    if (openId === 'more') { sheetBody.innerHTML = groupHTML(groupsById.more); applyTheme(currentTheme()); syncPersonaLabel(); }
    const prefs = drawer && drawer.querySelector('.shl-mm-prefs');
    if (prefs) prefs.innerHTML = '<div class="shl-mm-title">Preferences</div>' + prefsHTML();
  }

  /* ---------------------------------------------------------------
     SERVICE WORKER — one registration point for every page
     --------------------------------------------------------------- */
  function registerSW() {
    if (!('serviceWorker' in root.navigator) || root.location.protocol === 'file:') return;
    root.addEventListener('load', function () {
      root.navigator.serviceWorker.register(url('sw.js'), { scope: BASE || './' }).catch(function (err) {
        console.warn('[shell] service worker registration failed', err);
      });
    });
  }

  /* ---------------------------------------------------------------
     START
     --------------------------------------------------------------- */
  function start() {
    captureLegacy();
    sprite();
    renderHeader();
    renderFooter();
    buildSheet();
    buildDrawer();
    loadCredentials();
    applyTheme(currentTheme());
    personaLabel = doc.documentElement.dataset.personaLabel ||
      (legacy.persona && legacy.persona.querySelector('.pp-label') && legacy.persona.querySelector('.pp-label').textContent.trim()) || null;
    if (legacy.persona && root.MutationObserver) {
      const lbl = legacy.persona.querySelector('.pp-label');
      if (lbl) new MutationObserver(function () { personaLabel = lbl.textContent.trim(); syncPersonaLabel(); })
        .observe(lbl, { childList: true, characterData: true, subtree: true });
    }
    syncPersonaLabel();
    initDisclosure();
    initTips();
    doc.addEventListener('click', onClick);
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openId) { e.preventDefault(); closeSheet(); }
      else if (e.key === 'Escape' && !drawer.hidden) { e.preventDefault(); closeDrawer(); }
      trapFocus(e); drawerTrap(e); dropKeys(e);
    });
    backdrop.addEventListener('click', function () { closeSheet(); });
    overlay.addEventListener('click', function () { closeDrawer(); });
    root.addEventListener('resize', function () { if (root.matchMedia('(min-width: 1100px)').matches) closeDrawer(true); });
    root.addEventListener('resize', function () { if (openId && sheet.classList.contains('is-popover')) closeSheet(true); });
    if (Install.installed()) doc.documentElement.classList.add('is-installed');
    Install.trackEngagement();
    registerSW();
    doc.documentElement.classList.add('shl-ready');
    root.dispatchEvent(new CustomEvent('shell:ready'));
  }

  root.ASilvaShell = {
    IA: IA, base: BASE, group: currentGroup, operator: operatorMode,
    open: function (id) { openSheet(id); }, close: closeSheet,
    openMenu: function () { openDrawer(); }, closeMenu: function () { closeDrawer(); },
    install: function () { return Install.install(); },
    installed: function () { return Install.installed(); },
    toast: toast
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
