/**
 * chat/engine.js — internal-intelligence conversation engine.
 *
 * REPLACES the previous Moonshot/Kimi integration entirely. There is no API
 * key, no outbound request, and no generated prose anywhere in this file.
 *
 * How a turn is resolved, in order:
 *   1. INTENT   — regex/keyword rules for the ~12 things visitors actually
 *                 ask (contact, availability, rates, a named project, a CV).
 *                 Deterministic, highest precedence.
 *   2. ENTITY   — direct hit on a project / discipline / publication name.
 *   3. RETRIEVAL— BM25 over the KB corpus built from credentials.json.
 *   4. CLARIFY  — below confidence threshold, the bot says it doesn't know
 *                 and offers the nearest real topics. It never improvises.
 *
 * Every answer is assembled from authored templates plus fields read out of
 * credentials.json, so the bot cannot state a metric that isn't in the file.
 */
(function (root) {
  'use strict';

  const NS = (root.ASilva = root.ASilva || {});
  if (NS.chatEngine) return;
  const { nlp, data } = NS;

  /* A hit must explain at least this much of the visitor's question before
     the bot will speak it as an answer. Normalized BM25 score is unusable as
     a gate (the top hit is always 1.0), so coverage carries the decision and
     score only breaks ties. Raised from a score-based 0.34 after
     "can he build me a mobile game" matched Capacity Building at 1.00 on the
     single shared token "build". */
  const COVERAGE_FLOOR = 0.5;
  const MIN_MATCHED = 1;


  /* ------------------------------------------------------------- persona lens
   * The site is persona-adaptive: the visitor picks a lens (or arrives with
   * one) and the copy reshapes around it. Retrieval has to honour the same
   * contract, or the promise breaks — the widget header says "Answering for:
   * private" while returning government-framed prose, and AI-Chorus renders
   * four identical columns.
   *
   * A lens does three things, in ascending order of visibility:
   *   1. RANK    — boost records in the sectors and domains that lens cares about
   *   2. FRAME   — lead multi-item answers with a line written for that reader
   *   3. SUGGEST — offer opening questions that reader would actually ask
   *
   * It never changes the facts. Same record, different entry point.
   */
  const LENSES = {
    government: {
      sectors: ['government'], domains: ['risk'],
      disciplines: ['strategic-thinking-planning', 'disaster-risk-reduction', 'climate-change-adaptation'],
      frame: 'Framed for a government or policy reader — mandate, compliance, and what survives a transition.',
      suggestions: ['BIRD 2026-2035', 'Procurement and compliance', 'Policy and planning work', 'How engagements start']
    },
    humanitarian: {
      sectors: ['humanitarian'], domains: ['risk'],
      disciplines: ['disaster-risk-reduction', 'climate-change-adaptation', 'capacity-building'],
      frame: 'Framed for a humanitarian or NGO reader — field delivery, fragile contexts, and reach.',
      suggestions: ['DRR and CCA work', 'MEL and evaluation', 'MHPSS and training', 'Fragile-context experience']
    },
    private: {
      sectors: ['private'], domains: ['private', 'digital', 'innovation'],
      disciplines: ['private-sector-msme-development', 'digital-transformation-data-engineering',
                    'innovation-entrepreneurship', 'digital-growth-brand-strategy'],
      frame: 'Framed for a commercial reader — what gets built, what it costs to de-risk, and how it scales.',
      suggestions: ['What can he actually build?', 'MSME and private-sector work', 'Platforms he has shipped', 'What makes his profile unusual?']
    },
    academic: {
      sectors: ['academic'], domains: ['innovation'],
      disciplines: ['systems-innovation', 'strategic-thinking-planning'],
      frame: 'Framed for an academic reader — method, evidence, and citable output.',
      suggestions: ['Published work', 'Research methodology', 'Credentials and memberships', 'University collaborations']
    },
    executive: {
      sectors: [], domains: [],
      disciplines: [],
      frame: null,
      suggestions: ['What makes his profile unusual?', 'Recent projects', 'What can he actually build?', 'Contact details']
    }
  };

  /** Read the active lens from the document, then localStorage, then default. */
  function activeLens() {
    let id = null;
    try {
      id = document.documentElement.dataset.persona
        || (window.localStorage && window.localStorage.getItem('as-persona'));
    } catch (_) { /* storage blocked */ }
    return { id: id || 'executive', lens: LENSES[id] || LENSES.executive };
  }

  /* ------------------------------------------------------------------ corpus */

  /**
   * Flatten credentials.json + kb.json into retrievable documents.
   * Each doc keeps a `render` describing how to speak it.
   */
  function buildCorpus(D) {
    const docs = [];

    (D.kb.entries || []).forEach((e, i) => docs.push({
      id: `kb:${e.id || i}`, kind: 'kb', weight: e.weight ?? 1.15,
      text: [e.q, (e.variants || []).join(' '), (e.tags || []).join(' '), e.a].join(' '),
      title: e.q, answer: e.a, actions: e.actions || []
    }));

    (D.projects || []).forEach((p) => docs.push({
      id: `project:${p.id}`, kind: 'project', ref: p, weight: 1,
      text: [p.name, p.sector, p.year, p.funding, (p.keywords || []).join(' '),
             p.description || ''].filter(Boolean).join(' '),
      title: p.name
    }));

    (D.disciplines || []).forEach((d) => docs.push({
      id: `discipline:${d.id}`, kind: 'discipline', ref: d, weight: 1.05,
      text: [d.name, (d.keywords || []).join(' '), (d.projects || []).join(' ')].join(' '),
      title: d.name
    }));

    (D.publications || []).forEach((p) => docs.push({
      id: `publication:${p.id}`, kind: 'publication', ref: p, weight: 1,
      text: [p.title, p.type, p.year, p.publisher || '', p.summary || ''].join(' '),
      title: p.title
    }));

    (D.certifications || []).forEach((c, i) => docs.push({
      id: `certification:${i}`, kind: 'certification', ref: c, weight: 1.05,
      text: [c.name, c.issuer, c.domain, c.status, c.faculty || '', c.note || ''].join(' '),
      title: c.name
    }));

    (D.appointments || []).forEach((a, i) => docs.push({
      id: `appointment:${i}`, kind: 'appointment', ref: a, weight: 1.05,
      text: [a.role, a.program, a.organization, a.focus || ''].join(' '),
      title: `${a.role} — ${a.organization}`
    }));

    (D.memberships || []).forEach((m, i) => docs.push({
      id: `membership:${i}`, kind: 'membership', ref: m, weight: 1.05,
      text: [m.name, m.organization, (m.recognized_fields || []).join(' ')].join(' '),
      title: `${m.name}, ${m.organization}`
    }));

    if ((D.institutions || []).length) docs.push({
      id: 'meta:institutions', kind: 'institutions', weight: 1,
      text: 'clients institutions partners donors funders worked with organisations ' +
            D.institutions.join(' '),
      title: 'Institutional partners'
    });

    return docs;
  }

  /* ----------------------------------------------------------------- intents */

  const money = (v) => (v == null || v === '' ? null : String(v));

  const INTENTS = [
    {
      id: 'greeting',
      test: (q) => /^\s*(hi|hey|hello|good\s+(morning|afternoon|evening)|kumusta|kamusta)\b/i.test(q),
      run: (_q, D) => {
        const { id, lens } = activeLens();
        const opener = {
          government: 'Hello. Ask me about mandates, frameworks, and what has survived audit and transition.',
          humanitarian: 'Hello. Ask me about field delivery, fragile contexts, and evaluation.',
          private: 'Hello. Ask me what gets built, what it de-risks, and how it scales.',
          academic: 'Hello. Ask me about method, evidence, and published output.'
        }[id] || `Hello. I'm the assistant for **${D.profile.name}**.`;
        return {
          text: `${opener}\n\nI answer from his verified record, not from a language model — everything traces to a real project file or certificate.`,
          chips: lens.suggestions.slice(0, 4)
        };
      }
    },
    {
      id: 'identity',
      /* Scoped to Alvin specifically. The earlier pattern matched a bare
         "who are ...", so "who are his clients" resolved to a bio instead of
         the sector breakdown. */
      test: (q) => /\b(who\s+(is|are)\s+(alvin|he|you|mr\.?\s*silva)|about\s+(him|alvin)|introduce\s+(him|yourself)|his\s+background|what\s+does\s+he\s+do)\b/i.test(q),
      run: (_q, D) => {
        const p = D.profile;
        const yrs = p.years_total ? `${p.years_total}+ years` : 'over a decade';
        return {
          text: `**${p.name}** — ${p.title}.\n\n${yrs} across ${p.countries || 'multiple'} countries, working at the intersection of climate and disaster resilience, strategic planning, and development management. ${(p.degrees || [])[0] || ''}\n\nHe operates through two brands: **ASilva Innovations** (consulting) and **Cognitio+** (platform and publications).`,
          chips: ['Areas of expertise', 'Notable projects', 'Published work', 'Contact']
        };
      }
    },
    {
      id: 'contact',
      test: (q) => /\b(contact|email|reach|get in touch|phone|linkedin|hire|book a call|talk to)\b/i.test(q),
      run: (_q, D) => {
        const p = D.profile;
        const lines = [`**Email** — [${p.email}](mailto:${p.email})`];
        if (p.phone) lines.push(`**Phone** — ${p.phone}`);
        if (p.linkedin) lines.push(`**LinkedIn** — [profile](${p.linkedin})`);
        return {
          text: `Direct contact:\n\n${lines.join('\n')}\n\nEngagements typically start with a 30-minute scoping call — you bring the problem, he brings a structured read on feasibility.`,
          chips: ['What engagements does he take?', 'Which sectors?']
        };
      }
    },
    {
      id: 'availability',
      /* "capacity" alone is ambiguous — "capacity building" is a discipline,
         not a question about his calendar. Require the scheduling sense. */
      test: (q) => !/\bcapacity\s+(building|development|strengthening)\b/i.test(q)
        && /\b(available|availability|taking on|short.?term|fractional|freelance|full.?time|retainer|(his|your|current)\s+capacity|capacity\s+(to|for)\b)/i.test(q),
      run: () => ({
        text: `He takes engagements from short advisory sprints through multi-year embedded consulting, scoped to your mandate and budget cycle.\n\nCurrent capacity depends on active commitments — the honest answer is to ask him directly rather than have me guess.`,
        chips: ['Contact details', 'Recent projects']
      })
    },
    {
      id: 'rates',
      test: (q) => /\b(rate|rates|fee|fees|cost|price|pricing|how much|budget|charge|day rate)\b/i.test(q),
      run: (_q, D) => ({
        text: `Rates aren't published — they vary by scope, duration, and funding source (a UN framework contract and an LGU engagement don't price the same way).\n\nEmail [${D.profile.email}](mailto:${D.profile.email}) with your scope and timeline and you'll get a straight number.`,
        chips: ['Contact details', 'What engagements does he take?']
      })
    },
    {
      id: 'cv',
      test: (q) => /\b(cv|resume|curriculum|vitae|send.*(cv|resume)|download.*(cv|resume))\b/i.test(q),
      run: (q, D) => {
        const versions = D.cv_versions || [];
        if (!versions.length) return null;
        const scored = versions.map((v) => ({
          v, s: nlp.tokenize([v.file, (v.disciplines || []).join(' '), (v.keywords || []).join(' '), v.sector_focus].join(' '))
                .filter((t) => nlp.tokenize(q).includes(t)).length
        })).sort((a, b) => b.s - a.s);
        const best = scored[0].s > 0 ? scored[0].v : null;
        const label = (f) => f.replace(/^Alvin_Silva_|_CV\.pdf$/g, '').replace(/-/g, ' ');
        if (best) {
          return {
            text: `There are ${versions.length} pre-tailored CV variants. For what you're describing, the closest fit is **${label(best.file)}**.\n\n[Open this CV](Alvin_Silva_CV_Versions/${best.file})`,
            chips: ['Show all CV variants', 'Contact details']
          };
        }
        return {
          text: `There are ${versions.length} CV variants, each tailored to a specialization:\n\n${versions.map((v) => `• [${label(v.file)}](Alvin_Silva_CV_Versions/${v.file})`).join('\n')}\n\nTell me the role or sector and I'll point at the right one.`,
          chips: ['Areas of expertise', 'Contact details']
        };
      }
    },
    {
      id: 'metrics',
      test: (q) => /\b(metric|metrics|numbers|track record|impact|how many|statistics|stats|scale)\b/i.test(q),
      run: (_q, D) => {
        const p = D.profile, rows = [];
        if (p.years_total) rows.push(`**${p.years_total}+ years** in development management and resilience`);
        if (p.countries) rows.push(`**${p.countries} countries** of operational exposure`);
        if (money(p.funding_designed)) rows.push(`**${p.funding_designed}** in climate-smart programming designed`);
        if (p.households_reached) rows.push(`**${p.households_reached} households** reached`);
        if (p.strategic_plans_facilitated) rows.push(`**${p.strategic_plans_facilitated}** strategic plans facilitated`);
        if (p.frameworks_published) rows.push(`**${p.frameworks_published}** published frameworks`);
        if (p.books_published) rows.push(`**${p.books_published}** published books`);
        return {
          text: `Verified track record:\n\n${rows.map((r) => `• ${r}`).join('\n')}\n\nEach figure traces to a documented engagement — ask about any one of them.`,
          chips: ['Notable projects', 'Published work', 'Which sectors?']
        };
      }
    },
    {
      id: 'expertise',
      test: (q) => /\b(expertise|specialis|specializ|skills|discipline|areas?|competenc|what.*good at|domain)\b/i.test(q),
      run: (_q, D) => {
        const { lens } = activeLens();
        const ordered = [...(D.disciplines || [])].sort((a, b) => {
          const la = lens.disciplines.includes(a.id) ? 1 : 0;
          const lb = lens.disciplines.includes(b.id) ? 1 : 0;
          return (lb - la) || (b.years - a.years);
        });
        return {
          text: (lens.frame ? `${lens.frame}\n\n` : '') +
            `Core disciplines, with depth in each:\n\n${ordered
              .map((d) => `• **${d.name}** — ${d.years} years`).join('\n')}\n\nAsk about any one and I'll show the engagements behind it.`,
          chips: ordered.slice(0, 4).map((d) => d.name)
        };
      }
    },
    {
      id: 'sectors',
      test: (q) => /\b(sector|sectors|clients?|who.*work(ed)? (with|for)|institution|donor|partner|government|ngo|humanitarian|private)\b/i.test(q),
      run: (_q, D) => {
        const counts = Object.entries(D.bySector || {})
          .map(([s, arr]) => `• **${s.charAt(0).toUpperCase() + s.slice(1)}** — ${arr.length} engagement${arr.length === 1 ? '' : 's'}`);
        return {
          text: `Engagements by sector:\n\n${counts.join('\n')}\n\nInstitutional partners include ${(D.institutions || []).slice(0, 8).join(', ')}${(D.institutions || []).length > 8 ? ', and others' : ''}.`,
          chips: ['Government work', 'Humanitarian work', 'Private sector work']
        };
      }
    },
    {
      id: 'projects',
      /* Negative guard: "how do engagements start" is a process question and
         belongs to the KB entry, not to a list of projects. */
      test: (q) => !/\bhow\s+(do|does|would|can)\b/i.test(q)
        && /\b(project|projects|portfolio|recent work|engagements?|case stud|what.*worked on)\b/i.test(q),
      run: (_q, D) => {
        const { lens } = activeLens();
        /* Sort the lens's own sector to the top before recency, so a private
           reader sees platforms first and a government reader sees mandates
           first — same 23 projects, different entry point. */
        const recent = [...(D.projects || [])]
          .sort((a, b) => {
            const la = lens.sectors.includes(a.sector) ? 1 : 0;
            const lb = lens.sectors.includes(b.sector) ? 1 : 0;
            return (lb - la) || ((b.year || 0) - (a.year || 0));
          }).slice(0, 6);
        return {
          text: (lens.frame ? `${lens.frame}\n\n` : '') +
            `Recent and flagship engagements:\n\n${recent.map((p) => `• **${p.name}**${p.year ? ` (${p.year})` : ''} — ${p.sector}${p.funding ? `, ${p.funding}` : ''}`).join('\n')}\n\nName any one for detail. The full set is on the [portfolio page](portfolio.html).`,
          chips: recent.slice(0, 3).map((p) => p.name)
        };
      }
    },
    {
      id: 'publications',
      test: (q) => /\b(book|books|publication|published|wrote|author|writing|read)\b/i.test(q),
      run: (_q, D) => ({
        text: `Published work:\n\n${(D.publications || []).map((p) =>
          `• **${p.title}** (${p.year}, ${p.type})${p.url ? ` — [read](${p.url})` : ''}`).join('\n')}`,
        chips: ['Personal Resilience', 'Areas of expertise', 'Contact details']
      })
    },
    {
      id: 'certifications',
      test: (q) => /\b(certif|credential|qualif|accredit|licen[cs]e|what.*(trained|studied)|education|degree)\b/i.test(q),
      run: (_q, D) => {
        const certs = D.certifications || [];
        if (!certs.length) return null;
        const live = certs.filter((c) => c.status !== 'expired');
        const lapsed = certs.filter((c) => c.status === 'expired');
        const line = (c) => `• **${c.name}** — ${c.issuer.split('—')[0].trim()} (${(c.issued || '').slice(0, 4)})`;
        let t = `${(D.profile.degrees || [])[0] || ''}\n\nCurrent credentials:\n\n${live.slice(0, 8).map(line).join('\n')}`;
        if (live.length > 8) t += `\n\n…and ${live.length - 8} more.`;
        if (lapsed.length) {
          t += `\n\nLapsed, stated plainly rather than left ambiguous:\n\n` +
               lapsed.map((c) => `• **${c.name}** — expired ${c.expires}`).join('\n');
        }
        return { text: t, chips: ['Technical capability', 'Areas of expertise', 'Contact details'] };
      }
    },
    {
      id: 'thanks',
      test: (q) => /\b(thank|thanks|salamat|cheers|appreciate)\b/i.test(q),
      run: () => ({
        text: `You're welcome. Anything else you'd like to check?`,
        chips: ['Notable projects', 'Contact details']
      })
    },
    {
      id: 'capability',
      test: (q) => /\b(are you (an? )?(ai|bot|robot|chatgpt|llm)|what are you|how do you work|are you real|are you human)\b/i.test(q),
      run: () => ({
        text: `I'm a retrieval assistant, not a language model. I match your question against Alvin's structured credentials file and return authored answers — no text generation, no external API, nothing leaves your browser.\n\nThe practical upside: I can't hallucinate a project he didn't do. The tradeoff: if it isn't in the record, I'll tell you I don't know rather than improvise.`,
        chips: ['What does he do?', 'Notable projects', 'Contact details']
      })
    }
  ];

  /* ------------------------------------------------------------------ render */

  function speakProject(p) {
    const bits = [];
    if (p.year) bits.push(`**Year** — ${p.year}`);
    if (p.sector) bits.push(`**Sector** — ${p.sector}`);
    if (p.funding) bits.push(`**Funding** — ${p.funding}`);
    if (p.client) bits.push(`**Client** — ${p.client}`);
    const kw = (p.keywords || []).length ? `\n\nFocus areas: ${p.keywords.join(', ')}.` : '';
    return {
      text: `**${p.name}**\n\n${bits.join('\n')}${p.description ? `\n\n${p.description}` : ''}${kw}`,
      chips: ['Other projects', 'Which sectors?', 'Contact details']
    };
  }

  function speakDiscipline(d, D) {
    const linked = (d.projects || []).length
      ? `\n\nEngagements: ${d.projects.join(', ')}.`
      : '';
    const cv = d.cv ? `\n\nMatching CV: [${d.cv.replace(/^Alvin_Silva_|_CV\.pdf$/g, '').replace(/-/g, ' ')}](Alvin_Silva_CV_Versions/${d.cv})` : '';
    return {
      text: `**${d.name}** — ${d.years} years of practice.${linked}${cv}`,
      chips: ['Other areas of expertise', 'Notable projects', 'Contact details']
    };
  }

  function speakCertification(c) {
    const rows = [`**Issuer** — ${c.issuer}`, `**Issued** — ${c.issued}`];
    if (c.credential_id) rows.push(`**Credential ID** — ${c.credential_id}`);
    /* Expiry is stated plainly. A lapsed credential presented as current is
       the kind of thing a procurement reviewer finds, and the bot should
       surface it rather than let the reader assume. */
    if (c.status === 'expired') rows.push(`**Status** — expired ${c.expires}`);
    return {
      text: `**${c.name}**\n\n${rows.join('\n')}` +
            (c.verify_url ? `\n\n[Verify this credential](${c.verify_url})` : '') +
            (c.note ? `\n\n${c.note}` : ''),
      chips: ['Other credentials', 'Areas of expertise', 'Contact details']
    };
  }

  function speakAppointment(a) {
    return {
      text: `**${a.role}** — ${a.organization}\n\n` +
            `**Program** — ${a.program}\n**Date** — ${a.date}` +
            (a.focus ? `\n\n${a.focus}` : ''),
      chips: ['Credentials', 'Notable projects', 'Contact details']
    };
  }

  function speakMembership(m) {
    return {
      text: `**${m.name}** — ${m.organization} (${m.issued})` +
            (m.reference ? `\n\n**Reference** — ${m.reference}` : '') +
            (m.recognized_fields ? `\n\nRecognized fields: ${m.recognized_fields.join(', ')}.` : ''),
      chips: ['Credentials', 'Areas of expertise']
    };
  }

  function speakPublication(p) {
    return {
      text: `**${p.title}** (${p.year})${p.summary ? `\n\n${p.summary}` : ''}${p.url ? `\n\n[Read it here](${p.url})` : ''}`,
      chips: ['Other publications', 'Areas of expertise']
    };
  }

  /* ------------------------------------------------------------------ engine */

  class Engine {
    constructor(D) {
      this.D = D;
      this.index = new nlp.Index(buildCorpus(D));
      this.history = [];
      this.lastEntity = null;
    }

    /** Default opening chips, derived from real content. */
    suggestions() {
      const { lens } = activeLens();
      if (lens.suggestions && lens.suggestions.length) return lens.suggestions.slice(0, 4);
      const kbSug = (this.D.kb && this.D.kb.suggestions) || [];
      if (kbSug.length) return kbSug.slice(0, 4);
      return ['What does he do?', 'Recent projects', 'Areas of expertise', 'Contact details'];
    }

    /** Current lens id — used by the widget header and by AI-Chorus. */
    lens() { return activeLens().id; }

    /**
     * Resolve one turn. Returns { text, chips, source, confidence }.
     * Pure function of (query, corpus, lastEntity) — no side effects beyond
     * history bookkeeping.
     */
    respond(query) {
      const q = String(query || '').trim();
      if (!q) return this._clarify('');

      /* Follow-up resolution: "tell me more" refers to the last entity. */
      if (/^(tell me more|more|go on|and\?|elaborate|details?)\b/i.test(q) && this.lastEntity) {
        const r = this._speakEntity(this.lastEntity);
        if (r) return this._finish(q, { ...r, source: 'followup', confidence: 1 });
      }

      /* 1. Intents */
      for (const it of INTENTS) {
        if (!it.test(q)) continue;
        const r = it.run(q, this.D);
        if (r) return this._finish(q, { ...r, source: `intent:${it.id}`, confidence: 1 });
      }

      /* 2 + 3. Retrieval, ranked through the active lens */
      const { lens } = activeLens();
      const hits = this.index.search(q, {
        limit: 5,
        boost: (d) => {
          let b = d.weight || 1;
          const r = d.ref || {};
          if (lens.sectors.includes(r.sector)) b *= 1.45;
          if (lens.domains.includes(r.domain)) b *= 1.35;
          if (lens.disciplines.includes((r.id || '').toString())) b *= 1.4;
          return b;
        }
      });

      const best = hits[0];
      const confident = best && best.matched >= MIN_MATCHED
        && (best.coverage >= COVERAGE_FLOOR || best.distinctive);

      if (confident) {
        const top = best.doc;

        if (top.kind === 'kb') {
          return this._finish(q, {
            text: top.answer,
            chips: top.actions.length ? top.actions : this._nearby(hits),
            source: `kb:${top.id}`, confidence: best.coverage
          });
        }
        const spoken = this._speakEntity(top);
        if (spoken) {
          this.lastEntity = top;
          return this._finish(q, { ...spoken, source: top.id, confidence: best.coverage });
        }
        if (top.kind === 'institutions') {
          return this._finish(q, {
            text: `Institutional partners and clients:\n\n${(this.D.institutions || []).map((i) => `• ${i}`).join('\n')}`,
            chips: ['Which sectors?', 'Notable projects'],
            source: top.id, confidence: best.coverage
          });
        }
      }

      return this._clarify(q, hits);
    }

    _speakEntity(doc) {
      if (doc.kind === 'project') return speakProject(doc.ref);
      if (doc.kind === 'discipline') return speakDiscipline(doc.ref, this.D);
      if (doc.kind === 'publication') return speakPublication(doc.ref);
      if (doc.kind === 'certification') return speakCertification(doc.ref);
      if (doc.kind === 'appointment') return speakAppointment(doc.ref);
      if (doc.kind === 'membership') return speakMembership(doc.ref);
      return null;
    }

    _nearby(hits) {
      return hits.slice(1, 4).map((h) => h.doc.title).filter(Boolean);
    }

    /**
     * The honest fallback. This is the whole point of running retrieval
     * instead of generation: when there's no grounded answer, say so.
     */
    _clarify(q, hits = []) {
      const near = hits.filter((h) => h.coverage > 0).slice(0, 4)
        .map((h) => h.doc.title).filter(Boolean);
      const text = near.length
        ? `I don't have a grounded answer for that in Alvin's record — and I'd rather say so than invent one.\n\nThe closest things I *do* have detail on:`
        : `That isn't in Alvin's credentials file, so I won't guess at it.\n\nFor anything outside the documented record, email [${this.D.profile.email}](mailto:${this.D.profile.email}) — he'll answer directly.`;
      return this._finish(q, {
        text,
        chips: near.length ? near : this.suggestions(),
        source: 'clarify', confidence: 0
      });
    }

    _finish(q, res) {
      this.history.push({ q, a: res.text, source: res.source, at: Date.now() });
      if (this.history.length > 40) this.history.shift();
      return res;
    }
  }

  /** Build an engine once data is loaded. */
  async function create() {
    const D = await data.load();
    return new Engine(D);
  }

  NS.chatEngine = { create, Engine, buildCorpus, COVERAGE_FLOOR, INTENTS };
})(window);
