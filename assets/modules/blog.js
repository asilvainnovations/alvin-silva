/**
 * modules/blog.js — writing/insights module.
 *
 * Content lives in assets/data/blog/index.json (the manifest) plus one
 * markdown-ish .json per post. No build step, no CMS: add a post file, add
 * an entry to the manifest, done.
 *
 * Mounts into any element carrying [data-asilva-blog]. On blog.html that's
 * the main container; drop the same attribute on index.html and you get a
 * "latest posts" strip for free (set data-limit="3").
 *
 * Routes: #/blog and #/blog/:slug
 */
(function (root) {
  'use strict';

  const NS = (root.ASilva = root.ASilva || {});
  const { el, renderInline, escapeHtml, escapeAttr } = NS.util;

  const PREFIX = () => (/\/personal-resilience\//.test(location.pathname) ? '../' : '');

  async function loadManifest() {
    const res = await fetch(PREFIX() + 'assets/data/blog/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`blog manifest -> HTTP ${res.status}`);
    const m = await res.json();
    return (m.posts || [])
      .filter((p) => p.status !== 'draft')
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  async function loadPost(slug) {
    const res = await fetch(`${PREFIX()}assets/data/blog/${encodeURIComponent(slug)}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`post "${slug}" -> HTTP ${res.status}`);
    return res.json();
  }

  const fmtDate = (d) => {
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  function card(p) {
    return el('article', { class: 'blog-card glass reveal' }, [
      el('div', { class: 'blog-card-meta' }, [
        el('time', { datetime: p.date, text: fmtDate(p.date) }),
        ...(p.tags || []).slice(0, 3).map((t) => el('span', { class: 'blog-tag', text: t }))
      ]),
      el('h3', {}, [el('a', { href: `#/blog/${encodeURIComponent(p.slug)}`, text: p.title })]),
      el('p', { class: 'blog-excerpt', text: p.excerpt || '' }),
      p.readingMinutes ? el('span', { class: 'blog-read', text: `${p.readingMinutes} min read` }) : null
    ]);
  }

  /** Render a post body. Blocks are typed; nothing is raw HTML. */
  function body(blocks) {
    const wrap = el('div', { class: 'blog-body' });
    (blocks || []).forEach((b) => {
      switch (b.type) {
        case 'h2': wrap.appendChild(el('h2', { text: b.text })); break;
        case 'h3': wrap.appendChild(el('h3', { text: b.text })); break;
        case 'p': wrap.appendChild(el('p', { html: renderInline(b.text) })); break;
        case 'quote': wrap.appendChild(el('blockquote', {}, [
          el('p', { html: renderInline(b.text) }),
          b.cite ? el('cite', { text: b.cite }) : null
        ])); break;
        case 'list': wrap.appendChild(el('ul', {},
          (b.items || []).map((i) => el('li', { html: renderInline(i) })))); break;
        case 'image': wrap.appendChild(el('figure', {}, [
          el('img', { src: b.src, alt: b.alt || '', loading: 'lazy', decoding: 'async' }),
          b.caption ? el('figcaption', { text: b.caption }) : null
        ])); break;
        case 'callout': wrap.appendChild(el('aside', {
          class: `blog-callout blog-callout-${escapeAttr(b.tone || 'note')}`,
          html: renderInline(b.text)
        })); break;
        default:
          if (b.text) wrap.appendChild(el('p', { html: renderInline(b.text) }));
      }
    });
    return wrap;
  }

  function setup(ctx) {
    const mount = ctx.mountEl;
    const limit = parseInt(mount.dataset.limit || '0', 10) || 0;
    let manifest = null;

    const busy = (msg) => { mount.textContent = ''; mount.appendChild(el('p', { class: 'blog-status', text: msg })); };

    async function showList() {
      try {
        if (!manifest) manifest = await loadManifest();
        mount.textContent = '';
        if (!manifest.length) { busy('No posts published yet.'); return; }
        const posts = limit ? manifest.slice(0, limit) : manifest;
        mount.appendChild(el('div', { class: 'blog-grid' }, posts.map(card)));
        if (limit && manifest.length > limit) {
          mount.appendChild(el('p', { class: 'blog-more' },
            [el('a', { href: 'blog.html', text: 'All writing \u2192' })]));
        }
      } catch (e) {
        console.error('[blog]', e);
        busy('Writing is temporarily unavailable.');
      }
    }

    async function showPost(slug) {
      busy('Loading\u2026');
      try {
        const p = await loadPost(slug);
        mount.textContent = '';
        mount.appendChild(el('article', { class: 'blog-post' }, [
          el('p', { class: 'blog-back' }, [el('a', { href: '#/blog', text: '\u2190 All writing' })]),
          el('h1', { text: p.title }),
          el('p', { class: 'blog-card-meta' }, [
            el('time', { datetime: p.date, text: fmtDate(p.date) }),
            ...(p.tags || []).map((t) => el('span', { class: 'blog-tag', text: t }))
          ]),
          p.excerpt ? el('p', { class: 'blog-lede', text: p.excerpt }) : null,
          body(p.body)
        ]));
        document.title = `${p.title} \u2014 Alvin M. Silva`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        console.error('[blog]', e);
        mount.textContent = '';
        mount.appendChild(el('div', {}, [
          el('p', { class: 'blog-status', text: 'That post could not be found.' }),
          el('p', {}, [el('a', { href: '#/blog', text: '\u2190 All writing' })])
        ]));
      }
    }

    if (NS.router) {
      NS.router.on('/blog', () => showList());
      NS.router.on('/blog/:slug', (params) => showPost(params.slug));
    }

    /* Initial paint: honour a deep link, otherwise list. */
    const path = NS.router ? NS.router.current() : '/';
    const m = /^\/blog\/(.+)$/.exec(path);
    if (m) showPost(decodeURIComponent(m[1])); else showList();

    return { showList, showPost, reload: () => { manifest = null; return showList(); } };
  }

  NS.registry.define({
    id: 'blog',
    version: '1.0.0',
    requires: ['util'],
    mount: '[data-asilva-blog]',
    routes: ['/blog', '/blog/:slug'],
    nav: { label: 'Writing', href: 'blog.html', order: 40 },
    setup
  });
})(window);
