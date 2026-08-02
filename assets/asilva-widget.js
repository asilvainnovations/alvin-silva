/**
 * ASilva AI Chatbot Widget
 * A self-contained, reusable chatbot widget for any page on the ASilva ecosystem.
 * 
 * Usage: <script src="assets/asilva-widget.js" defer></script>
 * 
 * Requires: Kimi API key stored in localStorage as 'asilva-kimi-key'
 * Shares state with inline chatbot via 'asilva-chat-state' localStorage key.
 */
(function() {
  'use strict';

  // Prevent double-init
  if (window.__ASILVA_WIDGET_INIT__) return;
  window.__ASILVA_WIDGET_INIT__ = true;

  const WIDGET_KEY = 'asilva-chat-state';
  const API_KEY_KEY = 'asilva-kimi-key';
  const API_URL = 'https://api.moonshot.cn/v1/chat/completions';
  const MODEL = 'moonshot-v1-8k';
  const LOGO_URL = 'https://asilvainnovations.github.io/alvin-silva/assets/logo-192.png';

  // Persona-aware directive — reads the active audience lens from the page
  function getPersonaDirective() {
    const persona = document.documentElement.dataset.persona || localStorage.getItem('as-persona');
    const directives = {
      government: `The user is a GOVERNMENT OFFICIAL or POLICYMAKER. Emphasize: strategic planning (BIRD 2026–2035, TESDA Strategic Plan), policy research (MMDA Urban Resilience), national frameworks, institutional strengthening, and measurable governance outcomes. Lead with decade-scale roadmaps and policy adoption metrics.`,
      humanitarian: `The user is an NGO / HUMANITARIAN PROFESSIONAL. Emphasize: DRR-CCA (RA 10121, ISO 31000, UNDRR compliance), community resilience (Balatan PSF, Salcedo CDP), MHPSS (WHO & DOH modules), food security and livelihoods, and fragile-context programming (BARMM, Mindanao). Lead with household reach and field-tested methodologies.`,
      private: `The user is a PRIVATE SECTOR / CORPORATE LEADER. Emphasize: systems innovation (DDRiVE-M, Strat Planner Pro, Cognitio+), organizational development (DLSU Performance Management), digital transformation, AI-powered platforms, and ROI-driven resilience. Lead with platform capabilities, completion rates, and scalable frameworks.`,
      academic: `The user is an ACADEMIC / RESEARCHER. Emphasize: published frameworks (10+ IP contributions), university collaborations (5+ institutions), research methodology (complex adaptive systems, survey validation), and the three published books. Lead with theoretical grounding, citation-ready metrics, and peer-reviewed outputs.`
    };
    return directives[persona] || directives.government;
  }

  const BASE_PROMPT = `You are ASilva AI, the professional assistant for Alvin M. Silva, MDM. You represent Alvin with authority, warmth, and precision.

IDENTITY:
- Full name: Alvin M. Silva, MDM (Asian Institute of Management)
- Title: Development Management Professional & Resilience Consultant
- Affiliations: Cognitio+ (alvin.silva@cognitioplus.com) and ASilva Innovations

IMPACT METRICS:
- 18+ years in development management and resilience consulting
- 15 countries across Asia, Africa, and the Pacific
- ₱190 million in climate-smart program funding designed and delivered
- 50,000+ households reached through resilience and livelihood interventions
- 30+ institutions: UNICEF, UNDP, ECHO, USAID, World Bank, WHO, TESDA, MMDA, DOH, BARMM BoI–MTIT, Action Against Hunger, AIM, SOLHUM
- 100% project completion rate with measurable outcomes documented
- 20+ strategic plans facilitated for governments, NGOs, and private sector
- 10+ published frameworks and intellectual property contributions
- 5+ university academic collaborations
- Policy inputs adopted into national resilience strategies in the Philippines

SEVEN DISCIPLINES:
1. Climate Change Adaptation — 15+ years with ECHO, USAID, World Bank
2. Disaster Risk Reduction — Certified DRR practitioner
3. Systems Innovation — Architect of DDRiVE-M, Strat Planner Pro, Cognitio+
4. Organizational Development — Performance systems for government and NGOs
5. Strategic Thinking & Planning — Sole author of national TESDA Strategic Plan 2026–2030
6. Capacity Building — MDM-trained facilitator, WHO/DOH frontline training
7. Security Risk Management — Certified SRMP

KEY PROJECTS:
- BIRD 2026–2035: Bangsamoro Investment Roadmapping Platform, lead technical architect
- DDRiVE-M: AI-powered DRR platform, RA 10121 / ISO 31000 / UNDRR compliant
- Strat Planner Pro: AI-powered PWA for systems diagnosis and execution
- RTL: Digital learning for growth, resilience, and wellness
- Cognitio+: Knowledge ecosystem for publishing, learning, evaluation
- Balatan Climate Resilience Hub: ₱190M PSF-funded community-based model
- WorldSkills Philippines TESDA Strategic Plan 2026–2030: Sole-authored national plan
- Risk-Informed CDP of Salcedo, Eastern Samar (2023–2028)
- MHPSS Intervention Module for Emergency Responders (WHO & DOH, 2023)
- IRRM for BARMM (USAID & Action Against Hunger, 2022)

PUBLICATIONS:
- "Personal Resilience: The Path to Oneness" (Cognitio+, 2025)
- "Resilient Futures: Nurturing Oneness in Education" (Cognitio+, 2024)
- "Building Resilience: The Path to a More Fulfilling Life" (Cognitio+, 2023)
- Shock-Responsive & Sustainable Livelihoods Process Manual (MOVEUP Mindanao, 2022)

CREDENTIALS:
- MDM, Asian Institute of Management
- Certified SRMP
- Certified International Humanitarian Practitioner
- Certified DRR Practitioner

TONE:
- Professional yet approachable. Direct and outcome-focused.
- Always tie responses to measurable impact.
- Use "Alvin" or "Mr. Silva" when referring to him.
- For availability/services, guide to: alvin.silva@asilvainnovations.com, LinkedIn, or index.html#contact
- Be honest if you don't know something. Keep responses concise (2–4 sentences) unless detail requested.
- Use bullet points for lists. Never make up projects, dates, or metrics.`;

  // Inject CSS
  const style = document.createElement('style');
  style.textContent = `
    .asilva-widget { position:fixed; bottom:1.2rem; right:1.2rem; z-index:2000; font-family:'Poppins',system-ui,sans-serif; }
    .asilva-trigger { width:60px; height:60px; border-radius:50%; border:3px solid #FFD700; background:#fff; cursor:pointer; box-shadow:0 8px 32px rgba(0,0,0,.35); transition:transform .3s cubic-bezier(.22,.8,.28,1), box-shadow .3s; padding:0; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    .asilva-trigger:hover { transform:scale(1.08) rotate(5deg); box-shadow:0 12px 40px rgba(255,215,0,.3); }
    .asilva-trigger img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
    .asilva-tooltip { position:absolute; right:70px; top:50%; transform:translateY(-50%); background:#fff; color:#0d1224; padding:.45rem .85rem; border-radius:10px; font-size:.78rem; font-family:'Roboto Condensed',system-ui,sans-serif; font-weight:600; white-space:nowrap; border:1px solid rgba(10,20,60,.16); box-shadow:0 8px 32px rgba(20,30,60,.10); opacity:0; visibility:hidden; transition:.25s; pointer-events:none; }
    .asilva-trigger:hover .asilva-tooltip { opacity:1; visibility:visible; }
    .asilva-panel { position:absolute; bottom:76px; right:0; width:min(400px, 92vw); height:560px; border-radius:20px; background:linear-gradient(135deg, rgba(255,255,255,.94), rgba(240,244,252,.9)); border:1px solid rgba(255,215,0,.28); backdrop-filter:blur(24px) saturate(180%); -webkit-backdrop-filter:blur(24px) saturate(180%); box-shadow:0 18px 48px rgba(20,30,60,.14), 0 6px 18px rgba(0,102,255,.12); display:flex; flex-direction:column; overflow:hidden; opacity:0; visibility:hidden; transform:translateY(16px) scale(.96); transition:all .35s cubic-bezier(.22,.8,.28,1); }
    .asilva-panel.open { opacity:1; visibility:visible; transform:none; }
    .asilva-header { display:flex; align-items:center; gap:.75rem; padding:1rem 1.2rem; border-bottom:1px solid rgba(10,20,60,.16); background:linear-gradient(135deg, rgba(255,215,0,.08), rgba(0,102,255,.05)); flex:none; }
    .asilva-avatar { width:40px; height:40px; border-radius:50%; border:2px solid #FFD700; object-fit:cover; background:#fff; }
    .asilva-header-info { flex:1; min-width:0; }
    .asilva-name { display:block; font-family:'Montserrat',system-ui,sans-serif; font-weight:700; font-size:.95rem; color:#0d1224; line-height:1.2; }
    .asilva-status { font-size:.72rem; color:#0f7d51; font-family:'Roboto Condensed',system-ui,sans-serif; letter-spacing:.04em; }
    .asilva-close { width:32px; height:32px; border-radius:50%; border:1px solid rgba(10,20,60,.16); background:rgba(90,110,160,.1); color:#0d1224; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; transition:.2s; flex:none; }
    .asilva-close:hover { background:#c62828; color:#fff; border-color:#c62828; }
    .asilva-messages { flex:1; overflow-y:auto; padding:1rem; display:flex; flex-direction:column; gap:.8rem; min-height:0; }
    .asilva-msg { display:flex; gap:.6rem; max-width:92%; animation:asilvaFadeUp .3s cubic-bezier(.22,.8,.28,1); }
    .asilva-msg.bot { align-self:flex-start; }
    .asilva-msg.user { align-self:flex-end; flex-direction:row-reverse; }
    .asilva-bubble { padding:.8rem 1rem; border-radius:14px; font-size:.88rem; line-height:1.65; color:#0d1224; word-break:break-word; }
    .asilva-msg.bot .asilva-bubble { background:rgba(90,110,160,.1); border:1px solid rgba(10,20,60,.16); border-bottom-left-radius:4px; }
    .asilva-msg.user .asilva-bubble { background:linear-gradient(135deg, #0057c2, #0069a8); color:#fff; border-bottom-right-radius:4px; }
    .asilva-typing { display:none; gap:4px; padding:.5rem 1rem; align-self:flex-start; }
    .asilva-typing.active { display:flex; }
    .asilva-typing span { width:7px; height:7px; border-radius:50%; background:rgba(20,26,46,.72); animation:asilvaTyping 1.4s infinite ease-in-out both; }
    .asilva-typing span:nth-child(1) { animation-delay:-.32s; }
    .asilva-typing span:nth-child(2) { animation-delay:-.16s; }
    @keyframes asilvaTyping { 0%,80%,100%{transform:scale(0);opacity:.5;} 40%{transform:scale(1);opacity:1;} }
    @keyframes asilvaFadeUp { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:none;} }
    .asilva-input-area { display:flex; gap:.5rem; padding:.75rem 1rem; border-top:1px solid rgba(10,20,60,.16); background:linear-gradient(135deg, rgba(10,20,60,.06), rgba(10,20,60,.025)); flex:none; }
    .asilva-input-area input { flex:1; padding:.65rem 1rem; border-radius:999px; border:1.5px solid rgba(10,20,60,.16); background:rgba(255,255,255,.85); color:#0d1224; font-family:'Poppins',system-ui,sans-serif; font-size:.9rem; outline:none; transition:.2s; }
    .asilva-input-area input:focus { border-color:#FFD700; box-shadow:0 0 0 3px rgba(255,215,0,.15); }
    .asilva-input-area input::placeholder { color:rgba(20,26,46,.72); }
    .asilva-input-area button { width:40px; height:40px; border-radius:50%; border:none; background:linear-gradient(135deg, #0057c2, #0069a8); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:.2s; flex:none; }
    .asilva-input-area button:hover { transform:scale(1.08); box-shadow:0 4px 14px rgba(0,102,255,.4); }
    .asilva-input-area button svg { width:18px; height:18px; fill:none; stroke:#fff; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
    .asilva-setup { padding:1rem; text-align:center; }
    .asilva-setup p { font-size:.85rem; color:rgba(20,26,46,.72); line-height:1.6; margin-bottom:.8rem; }
    .asilva-setup input { width:100%; padding:.65rem 1rem; border-radius:11px; border:1.5px solid rgba(10,20,60,.16); background:rgba(255,255,255,.85); color:#0d1224; font-family:'Poppins',system-ui,sans-serif; font-size:.9rem; margin-bottom:.5rem; }
    .asilva-setup input:focus { outline:none; border-color:#FFD700; box-shadow:0 0 0 3px rgba(255,215,0,.15); }
    .asilva-setup button { width:100%; padding:.5rem 1.05rem; border-radius:999px; border:2px solid transparent; cursor:pointer; font-family:'Montserrat',system-ui,sans-serif; font-weight:700; font-size:.8rem; letter-spacing:.03em; background:linear-gradient(135deg, #0057c2, #0069a8); color:#fff; box-shadow:0 8px 24px rgba(0,102,255,.35); }
    .asilva-setup button:hover { transform:translateY(-2px); box-shadow:0 14px 34px rgba(0,191,255,.45); }
    .asilva-disclaimer { font-size:.7rem; color:rgba(20,26,46,.72); text-align:center; padding:.5rem 1rem; border-top:1px solid rgba(10,20,60,.12); }
    @media (max-width:480px) {
      .asilva-panel { width:100vw; height:70vh; bottom:76px; right:-1.2rem; border-radius:20px 20px 0 0; }
      .asilva-widget { right:.8rem; bottom:.8rem; }
    }
    @media (prefers-color-scheme: dark) {
      .asilva-panel { background:linear-gradient(135deg, rgba(10,20,60,.62), rgba(10,14,39,.78)); border-color:rgba(255,215,0,.28); }
      .asilva-header { background:linear-gradient(135deg, rgba(255,215,0,.08), rgba(0,102,255,.05)); }
      .asilva-name { color:#fff; }
      .asilva-close { background:rgba(255,255,255,.06); color:#fff; border-color:rgba(255,255,255,.13); }
      .asilva-msg.bot .asilva-bubble { background:rgba(255,255,255,.06); border-color:rgba(255,255,255,.13); color:#fff; }
      .asilva-msg.user .asilva-bubble { color:#fff; }
      .asilva-input-area { background:linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.03)); border-color:rgba(255,255,255,.13); }
      .asilva-input-area input { background:rgba(10,16,42,.7); color:#fff; border-color:rgba(255,255,255,.13); }
      .asilva-input-area input::placeholder { color:rgba(224,230,237,.62); }
      .asilva-disclaimer { color:rgba(224,230,237,.62); border-color:rgba(255,255,255,.09); }
      .asilva-setup p { color:rgba(224,230,237,.62); }
      .asilva-setup input { background:rgba(10,16,42,.7); color:#fff; border-color:rgba(255,255,255,.13); }
    }
  `;
  document.head.appendChild(style);

  // Create DOM
  const widget = document.createElement('div');
  widget.className = 'asilva-widget';
  widget.setAttribute('aria-label', 'ASilva AI assistant');
  widget.innerHTML = `
    <div class="asilva-panel" id="asilvaPanel" role="dialog" aria-label="ASilva AI chat" aria-hidden="true">
      <div class="asilva-header">
        <img src="${LOGO_URL}" alt="ASilva AI" class="asilva-avatar" loading="lazy">
        <div class="asilva-header-info">
          <span class="asilva-name">ASilva AI</span>
          <span class="asilva-status">● Online</span>
        </div>
        <button class="asilva-close" id="asilvaClose" aria-label="Close chat">✕</button>
      </div>
      <div class="asilva-messages" id="asilvaMessages" role="log" aria-live="polite" aria-atomic="false"></div>
      <div class="asilva-typing" id="asilvaTyping" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="asilva-input-area">
        <input type="text" id="asilvaInput" placeholder="Ask about Alvin's work..." autocomplete="off" aria-label="Type your message">
        <button id="asilvaSend" aria-label="Send message">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
      <div class="asilva-disclaimer">Powered by Kimi AI · Responses are AI-generated</div>
    </div>
    <button class="asilva-trigger" id="asilvaTrigger" aria-label="Open ASilva AI chat assistant">
      <span class="asilva-tooltip">Ask ASilva AI</span>
      <img src="${LOGO_URL}" alt="ASilva AI" loading="lazy">
    </button>
  `;
  document.body.appendChild(widget);

  // Elements
  const panel = document.getElementById('asilvaPanel');
  const trigger = document.getElementById('asilvaTrigger');
  const closeBtn = document.getElementById('asilvaClose');
  const messagesEl = document.getElementById('asilvaMessages');
  const inputEl = document.getElementById('asilvaInput');
  const sendBtn = document.getElementById('asilvaSend');
  const typingEl = document.getElementById('asilvaTyping');

  let messages = [];
  let isOpen = false;
  let isTyping = false;

  try {
    const saved = localStorage.getItem(WIDGET_KEY);
    if (saved) messages = JSON.parse(saved);
  } catch (e) {}

  function saveMessages() {
    try { localStorage.setItem(WIDGET_KEY, JSON.stringify(messages.slice(-50))); } catch (e) {}
  }

  function renderMessages() {
    messagesEl.innerHTML = '';
    if (messages.length === 0) {
      const apiKey = localStorage.getItem(API_KEY_KEY);
      if (!apiKey) {
        messagesEl.innerHTML = `
          <div class="asilva-msg bot"><div class="asilva-bubble">Hello! I'm <strong>ASilva AI</strong>, Alvin's assistant. Ask me about his work, expertise, or how he can support your project.</div></div>
          <div class="asilva-msg bot"><div class="asilva-bubble">To enable AI responses, enter your Kimi API key below. Your key stays in your browser only.</div></div>
          <div class="asilva-setup">
            <input type="password" id="asilvaApiKey" placeholder="Paste your Kimi API key here">
            <button id="asilvaSaveKey"><span>Save Key & Start Chatting</span></button>
          </div>`;
        const saveKeyBtn = document.getElementById('asilvaSaveKey');
        const keyInput = document.getElementById('asilvaApiKey');
        if (saveKeyBtn && keyInput) {
          saveKeyBtn.addEventListener('click', () => {
            const key = keyInput.value.trim();
            if (!key) { alert('Please enter a valid API key'); return; }
            localStorage.setItem(API_KEY_KEY, key);
            messages = []; renderMessages();
            addBotMessage("Great! I'm ready. Ask me anything about Alvin's work, expertise, or how he can support your project.");
          });
          keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveKeyBtn.click(); });
        }
        return;
      }
      const persona = document.documentElement.dataset.persona || localStorage.getItem('as-persona') || 'government';
    const personaLabels = { government: 'Government & Policy', humanitarian: 'NGO & Humanitarian', private: 'Private Sector', academic: 'Academia & Research' };
    addBotMessage(`Hello! I'm <strong>ASilva AI</strong>, Alvin's assistant. I see you're exploring from a <strong>${personaLabels[persona] || 'Government & Policy'}</strong> perspective. Ask me about his work, expertise, or how he can support your specific context. What would you like to know?`);
      return;
    }
    messages.forEach(m => {
      const div = document.createElement('div');
      div.className = `asilva-msg ${m.role}`;
      div.innerHTML = `<div class="asilva-bubble">${m.content}</div>`;
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addUserMessage(text) {
    messages.push({ role: 'user', content: text, ts: Date.now() });
    saveMessages(); renderMessages();
  }

  function addBotMessage(text) {
    messages.push({ role: 'bot', content: text, ts: Date.now() });
    saveMessages(); renderMessages();
  }

  function setTyping(show) {
    isTyping = show;
    typingEl.classList.toggle('active', show);
    if (show) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage(text) {
    const apiKey = localStorage.getItem(API_KEY_KEY);
    if (!apiKey) { addBotMessage('Please set your Kimi API key first.'); return; }
    addUserMessage(text);
    setTyping(true);

    const apiMessages = [
      { role: 'system', content: BASE_PROMPT + '\n\n' + getPersonaDirective() },
      ...messages.slice(-20).map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content }))
    ];

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODEL, messages: apiMessages, temperature: 0.7, max_tokens: 800 })
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'I did not receive a response. Please try again.';
      setTyping(false); addBotMessage(reply);
    } catch (err) {
      setTyping(false); console.error('ASilva AI error:', err);
      addBotMessage('I'm having trouble connecting. Please check your API key or try again. You can also reach Alvin at <a href="mailto:alvin.silva@asilvainnovations.com">alvin.silva@asilvainnovations.com</a>.');
    }
  }

  function openChat() {
    isOpen = true; panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false'); trigger.setAttribute('aria-expanded', 'true');
    renderMessages(); setTimeout(() => inputEl?.focus(), 300);
  }
  function closeChat() {
    isOpen = false; panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true'); trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', () => { isOpen ? closeChat() : openChat(); });
  closeBtn.addEventListener('click', closeChat);
  sendBtn.addEventListener('click', () => {
    const text = inputEl.value.trim(); if (!text || isTyping) return;
    inputEl.value = ''; sendMessage(text);
  });
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
    if (e.key === 'Escape') closeChat();
  });

  // Subtle pulse on first visit
  const hasVisited = sessionStorage.getItem('asilva-widget-visited');
  if (!hasVisited) {
    sessionStorage.setItem('asilva-widget-visited', '1');
    setTimeout(() => {
      if (!isOpen) {
        trigger.style.animation = 'asilvaPulse 2s ease-in-out 2';
        setTimeout(() => { trigger.style.animation = ''; }, 4000);
      }
    }, 8000);
  }

  // Add pulse keyframe dynamically
  const pulseStyle = document.createElement('style');
  pulseStyle.textContent = `@keyframes asilvaPulse { 0%,100%{box-shadow:0 8px 32px rgba(0,0,0,.35);} 50%{box-shadow:0 8px 32px rgba(255,215,0,.5), 0 0 0 8px rgba(255,215,0,.1);} }`;
  document.head.appendChild(pulseStyle);
})();
