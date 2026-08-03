# Alvin Silva — Modular Document Customization System
A reusable prompt library for generating tailored CVs, cover letters, proposals, and letters of interest. Fill in the bracketed fields and hand the resulting prompt to Claude in this project — it already has your CV history, portfolio, and past application patterns in context.

---

## 1. The master prompt (copy, fill in, send)

```
Customize a [DOCUMENT TYPE: CV / cover letter / proposal / letter of interest]
for a [OPPORTUNITY TYPE: project evaluation / consulting engagement / job application]
role at [ORGANIZATION NAME], for the position of [ROLE TITLE].

Role source: [paste job posting / ToR URL, or attach the PDF]

Emphasize: [1–3 of: strategic planning · systems thinking · humanitarian consulting ·
climate change adaptation & DRR · organizational development · capacity building ·
M&E · security risk management]

Tone: [pick one primary + one modifier — see Tone Palette below]

Length/format: [1-page CV / 2-page CV · half-page cover letter / full cover letter ·
formatted .docx / plain text for portal paste-in]

Constraints to flag proactively: [e.g. "MDM vs. required degree field" ·
"salary expectations" · "availability date" · "years-of-experience gap"]

Include profile link: https://alvin.asilvainnovations.com
```

**What Claude will do with this automatically** (no need to ask separately):
- Pull the ToR/job posting (web-fetch it if you gave a URL) and map deliverables to your specific named engagements — not generic paraphrases.
- Cross-reference your CV library in the project to select the most relevant framing and evidence.
- Flag credential mismatches (e.g., MDM vs. a required education-sector or public-policy degree) with a suggested reframe, rather than silently ignoring the gap.
- Surface institutional relationships (UNICEF, CRS, GIZ, DFAT, etc.) that are direct differentiators for that specific opportunity.
- Produce the file as a proper `.docx` via the docx pipeline if you ask for a downloadable document; otherwise deliver clean markdown/plain text you can paste into a portal.

---

## 2. Tone palette (mix a primary + a modifier)

| Primary | Reads as | Best for |
|---|---|---|
| **Confident** | Direct, evidence-first, no hedging | Government/donor ToRs, competitive bids |
| **Witty** | Sharp, a little dry, memorable phrasing without gimmicks | Private-sector pitches, letters of interest to smaller orgs |
| **Respectful** | Formal, deferential to institutional hierarchy | UN agencies, ministries, first contact with new partners |
| **Philosophical** | Systems-level framing, names the "why" behind the "what" | Academic/research audiences, thought-leadership proposals |
| **Culturally sensitive** | Explicit acknowledgment of local context (BARMM, Mindanao, LGU-level nuance) | Bangsamoro/regional engagements, conflict-sensitive contexts |

Modifiers layer on top: *concise, warm, understated, data-forward, narrative-led.*

Example combos that work well for you:
- **Confident + data-forward** → USAID/World Bank technical proposals
- **Respectful + culturally sensitive** → BARMM/Bangsamoro Development Agency engagements
- **Witty + understated** → private-sector consulting pitches (e.g. DLSU, corporate clients)
- **Philosophical + narrative-led** → academic collaborations, published-framework credibility plays

---

## 3. Document-type quick prompts

Use these as drop-in shorthand instead of the full master prompt when you just need one thing fast.

**CV only:**
> "Tailor my CV for [ROLE] at [ORG]. Pull from my most relevant existing CV version. Confident, data-forward tone. Flag any credential gaps. Deliver as .docx."

**Cover letter only:**
> "Write a cover letter for [ROLE] at [ORG], referencing [ToR/posting]. [TONE]. Map 2–3 of my named engagements directly to their stated deliverables. Half a page, docx."

**Proposal / expression of interest:**
> "Draft an expression of interest for [OPPORTUNITY] with [ORG]. Philosophical + confident tone — lead with the systems-level problem before my qualifications. Include profile link."

**Letter of interest (informal/exploratory):**
> "Write a short letter of interest to [ORG/CONTACT] about [OPPORTUNITY TYPE], no formal ToR yet. Witty + respectful. Position this as opening a conversation, not applying to a posted role."

---

## 4. Standing defaults (already known — no need to repeat these)
- Profile link: `https://alvin.asilvainnovations.com`
- Full name/credential: Alvin M. Silva, MDM (Asian Institute of Management, ADB Scholar)
- Sectors: education-sector M&E, strategic planning, climate resilience, DRR, humanitarian programming, sustained BARMM/Bangsamoro engagement
- Key institutional relationships: USAID, EU, GIZ, DFAT, World Bank, UNICEF, DepEd, DBM, Bangsamoro Development Agency, Mindanao Development Authority, AIM
- Output pipeline: `.docx` via Node.js/`docx` + LibreOffice conversion + PDF visual QA before delivery

---

## 5. One-line variants for fast iteration
Once a document exists, these follow-ups reuse it without restating context:
- *"Make this more [tone] and cut it to one page."*
- *"Reframe the credentials section to lead with the DFAT/DepEd evaluation instead of the MDM."*
- *"Give me a second version pitched to [different audience] from the same base."*
- *"Convert this into a portal-paste plain-text version, no formatting."*
