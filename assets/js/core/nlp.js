/**
 * core/nlp.js — deterministic text-matching primitives.
 *
 * This is the "internal intelligence": classical information retrieval, run
 * entirely in the visitor's browser. No model, no API key, no network call,
 * no generation. Given the same corpus and the same query it returns the
 * same ranked result every time — which is the property you want when the
 * bot is speaking on Alvin's behalf about verifiable engagements.
 *
 * Components:
 *   tokenize()  — lowercase, fold diacritics, strip punctuation
 *   stem()      — light Porter-style suffix stripping (English)
 *   Index       — BM25 ranking over a document set
 *   fuzzy()     — Dice-coefficient bigram similarity for typo tolerance
 */
(function (root) {
  'use strict';

  const NS = (root.ASilva = root.ASilva || {});
  if (NS.nlp) return;

  const STOPWORDS = new Set(('a an and are as at be been but by can could did do does for from ' +
    'had has have he her him his how i if in into is it its me my of on or our out she should ' +
    'so some such than that the their them then there these they this those to too under up ' +
    'was we were what when where which who whom why will with would you your about please tell ' +
    'give show know want need like just really very more most any').split(' '));

  /* Domain synonyms — maps the many ways a visitor phrases a concept onto the
     vocabulary actually used in credentials.json. Extend freely; it is a
     plain map, not a learned embedding. */
  const SYNONYMS = {
    cv: ['resume', 'curriculum', 'vitae', 'profile'],
    drr: ['disaster', 'risk', 'reduction', 'hazard'],
    cca: ['climate', 'adaptation', 'adaptive'],
    mel: ['monitoring', 'evaluation', 'learning', 'me&l', 'm&e'],
    hire: ['engage', 'available', 'availability', 'contract', 'consult', 'retain', 'book'],
    cost: ['rate', 'fee', 'price', 'pricing', 'budget', 'charge'],
    contact: ['email', 'reach', 'phone', 'call', 'message', 'linkedin'],
    experience: ['background', 'history', 'career', 'worked', 'track', 'record'],
    book: ['publication', 'published', 'wrote', 'author', 'writing'],
    project: ['engagement', 'assignment', 'work', 'deliverable', 'portfolio']
  };
  const SYN_INDEX = (() => {
    const m = new Map();
    for (const [canon, list] of Object.entries(SYNONYMS)) {
      m.set(canon, canon);
      list.forEach((w) => m.set(w, canon));
    }
    return m;
  })();

  const fold = (s) => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .toLowerCase();

  /** Light suffix stripping. Not full Porter — enough to unify plural/tense. */
  function stem(w) {
    if (w.length <= 3) return w;
    return w
      .replace(/(ational|ization|iveness|fulness|ousness)$/, '')
      .replace(/(ing|edly|edness)$/, '')
      .replace(/(ies)$/, 'y')
      .replace(/(sses|shes|ches|xes)$/, '')
      .replace(/([^s])s$/, '$1')
      .replace(/(ed|er|ly|al|ance|ence|ment|ness|ity|ies)$/, '')
      || w;
  }

  function tokenize(text, { keepStop = false } = {}) {
    const raw = fold(text).replace(/[^a-z0-9&+₱#\s.-]/g, ' ').split(/[\s.]+/);
    const out = [];
    for (let t of raw) {
      t = t.replace(/^[-+#]+|[-+#]+$/g, '');
      if (!t || t.length < 2) continue;
      if (!keepStop && STOPWORDS.has(t)) continue;
      /* Synonyms are deliberately NOT folded here. Collapsing "climate",
         "adaptation" and "cca" into one token flattens their IDF, so a
         distinctive domain term stops being distinctive and the corpus loses
         the very signal that makes retrieval work. Synonyms are expanded at
         query time instead — see Index.correct(). */
      const st = stem(t);
      /* Re-check after stemming: "whats" -> "what" and "does" -> "doe" would
         otherwise survive as content terms and dilute coverage. */
      if (!keepStop && (STOPWORDS.has(st) || st.length < 2)) continue;
      out.push(st);
    }
    return out;
  }

  /** Dice coefficient over character bigrams — cheap typo tolerance. */
  function fuzzy(a, b) {
    a = fold(a); b = fold(b);
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const grams = (s) => {
      const g = new Map();
      for (let i = 0; i < s.length - 1; i++) {
        const k = s.slice(i, i + 2);
        g.set(k, (g.get(k) || 0) + 1);
      }
      return g;
    };
    const ga = grams(a), gb = grams(b);
    let hits = 0, total = 0;
    ga.forEach((n, k) => { total += n; hits += Math.min(n, gb.get(k) || 0); });
    gb.forEach((n) => { total += n; });
    return total ? (2 * hits) / total : 0;
  }

  /**
   * BM25 index. Documents are { id, text, ...meta }.
   * k1 controls term-frequency saturation, b controls length normalization.
   */
  class Index {
    constructor(docs = [], { k1 = 1.4, b = 0.72 } = {}) {
      this.k1 = k1; this.b = b;
      this.docs = [];
      this.df = new Map();
      this.avgLen = 0;
      docs.forEach((d) => this.add(d));
      this.finalize();
    }

    add(doc) {
      const terms = tokenize(doc.text);
      const tf = new Map();
      terms.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
      tf.forEach((_, t) => this.df.set(t, (this.df.get(t) || 0) + 1));
      this.docs.push({ ...doc, _tf: tf, _len: terms.length || 1 });
      return this;
    }

    finalize() {
      const n = this.docs.length || 1;
      this.avgLen = this.docs.reduce((s, d) => s + d._len, 0) / n;
      this.idf = new Map();
      this.df.forEach((df, t) => {
        this.idf.set(t, Math.log(1 + (n - df + 0.5) / (df + 0.5)));
      });
      this.vocab = [...this.df.keys()];
      this.maxIdf = Math.max(...this.idf.values(), 1);
      return this;
    }

    /**
     * Map each query term onto the corpus vocabulary, correcting typos once
     * globally instead of re-guessing inside every document.
     *
     * Returns [{ term, known, weight }]. A term with no vocabulary neighbour
     * is kept and marked unknown — that is signal, not noise: it means the
     * visitor asked about something the corpus has no word for at all, and it
     * should count against confidence rather than being quietly dropped.
     */
    correct(query) {
      return tokenize(query).map((t) => {
        if (this.df.has(t)) {
          return { term: t, known: true, weight: this.idf.get(t) };
        }
        /* Try the synonym group before reaching for fuzzy matching: an exact
           hit on a known alternate beats an approximate hit on anything. */
        const group = SYNONYMS[SYN_INDEX.get(t)] || [];
        const alts = [SYN_INDEX.get(t), ...group].filter(Boolean).map(stem);
        for (const a of alts) {
          if (this.df.has(a)) {
            return { term: a, known: true, weight: this.idf.get(a), expanded: t };
          }
        }
        let best = null, bestSim = 0;
        for (const v of this.vocab) {
          if (Math.abs(v.length - t.length) > 3) continue;
          const sim = fuzzy(t, v);
          if (sim > bestSim) { bestSim = sim; best = v; }
        }
        if (best && bestSim >= 0.70) {
          return { term: best, known: true, weight: this.idf.get(best) * bestSim, corrected: t };
        }
        /* Unknown to the corpus entirely. Weighted heavily — a query made
           mostly of unknown terms is out of scope and must not clear the
           coverage floor on one incidental shared word — but not at full
           maxIdf, so a single stray typo cannot veto an otherwise clear hit. */
        return { term: t, known: false, weight: this.maxIdf * 0.62 };
      });
    }

    /** Returns [{ doc, score }] sorted desc, scores normalized to 0..1. */
    search(query, { limit = 5, boost = null } = {}) {
      const qTerms = this.correct(query);
      if (!qTerms.length) return [];
      const { k1, b, avgLen } = this;
      const totalWeight = qTerms.reduce((s, t) => s + t.weight, 0) || 1;
      /* Query terms rare enough in the corpus to be near-unique identifiers. */
      const strongTerms = qTerms
        .filter((t) => t.known && t.weight >= this.maxIdf * 0.8)
        .map((t) => t.term);

      const scored = this.docs.map((d) => {
        let s = 0, matched = 0, hitWeight = 0;
        for (const q of qTerms) {
          const f = d._tf.get(q.term) || 0;
          if (!f) continue;
          matched++;
          hitWeight += q.weight;
          const idf = this.idf.get(q.term) ?? Math.log(1 + this.docs.length);
          s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (d._len / avgLen))));
        }
        if (boost) s *= boost(d) || 1;
        /* Coverage — how much of what the visitor asked this document actually
           accounts for, weighted by how discriminating each term is. Raw score
           is unusable as a confidence signal because it is normalized against
           the best hit, so the top result always reads 1.0 even when it shares
           one incidental word. Coverage is what separates "answered the
           question" from "happens to contain that word". */
        return {
          doc: d, score: s, matched,
          coverage: hitWeight / totalWeight,
          /* True when the visitor named something that appears in only one or
             two documents — a project name, an agency, a place. Naming
             "Salcedo" or "TESDA" is unambiguous intent even when the rest of
             the sentence is noise, so this bypasses the coverage floor. */
          distinctive: strongTerms.some((t) => d._tf.has(t))
        };
      }).filter((r) => r.score > 0);

      if (!scored.length) return [];
      scored.sort((x, y) => (y.coverage - x.coverage) || (y.score - x.score));
      const max = Math.max(...scored.map((r) => r.score)) || 1;
      return scored.slice(0, limit).map((r) => ({
        ...r, raw: r.score, score: r.score / max
      }));
    }
  }

  NS.nlp = { tokenize, stem, fuzzy, fold, Index, STOPWORDS, SYNONYMS };
})(window);
