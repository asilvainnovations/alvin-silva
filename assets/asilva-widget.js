/**
 * ASilva Intelligent Chatbot Assistant.
 * This browser-native assistant replaces the external artificial-intelligence service dependency.
 * It builds its knowledge base from credentials.json, profile context, portfolio data, and system architecture.
 * It performs deterministic semantic matching, strategic reasoning, systems thinking, futures thinking, and recommendation generation locally.
 */
(function () {
  "use strict";

  /* Prevent duplicate initialization when the script is loaded more than once. */
  if (window.__ASILVA_INTELLIGENT_ASSISTANT__) return;
  window.__ASILVA_INTELLIGENT_ASSISTANT__ = true;

  /* Define the assistant configuration in one place. */
  const CONFIG = {
    credentialsPath: "credentials.json",
    architecturePath: "assets/data/system-architecture.json",
    widgetStorageKey: "asilva-intelligent-chat-state",
    personaStorageKey: "as-persona",
    logoPath: "assets/logo-192.png",
    maximumHistoryMessages: 12,
    minimumSimilarityScore: 0.08
  };

  /* Define the supported reasoning lenses. */
  const REASONING_LENSES = {
    strategic: "Strategic Thinking",
    systems: "Systems Thinking",
    futures: "Futures Thinking",
    cognitive: "Cognitive Science",
    physical: "Modern Physical Science",
    resilience: "Resilience Thinking",
    innovation: "Systems Innovation"
  };

  /* Define the public professional identity supplied for the assistant. */
  const PROFESSIONAL_IDENTITY = {
    title: "Development Management Professional",
    specialization: "Disaster Risk Reduction and Climate Change Adaptation Consultant",
    innovationRole: "Systems Innovation Practitioner",
    humanitarianCredential: "Certified International Humanitarian",
    mission: "Driving impactful solutions and fostering co-creation for a more sustainable and resilient future through strategic innovation and resilience-building."
  };

  /* Store the local knowledge base after it has been loaded. */
  let knowledgeBase = {
    credentials: null,
    architecture: null,
    searchDocuments: []
  };

  /* Store the conversation state locally. */
  let conversationState = {
    messages: []
  };

  /* Escape user and knowledge-base text before placing it into the document. */
  function escapeHtml(value) {
    const temporaryElement = document.createElement("div");
    temporaryElement.textContent = String(value ?? "");
    return temporaryElement.innerHTML;
  }

  /* Normalize text for local semantic comparison. */
  function normalizeText(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s₱–—.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* Tokenize normalized text while removing very common English words. */
  function tokenize(value) {
    const stopWords = new Set([
      "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for",
      "from", "has", "how", "i", "in", "is", "it", "me", "of", "on", "or",
      "the", "to", "was", "what", "when", "where", "which", "who", "with",
      "would", "you", "your"
    ]);

    return normalizeText(value)
      .split(" ")
      .filter((token) => token.length > 2 && !stopWords.has(token));
  }

  /* Calculate a simple weighted semantic similarity score without an external service. */
  function calculateSimilarity(query, documentText) {
    const queryTokens = new Set(tokenize(query));
    const documentTokens = new Set(tokenize(documentText));

    if (!queryTokens.size || !documentTokens.size) return 0;

    let sharedTokenCount = 0;

    queryTokens.forEach((token) => {
      if (documentTokens.has(token)) sharedTokenCount += 1;
    });

    return sharedTokenCount / Math.sqrt(queryTokens.size * documentTokens.size);
  }

  /* Build a searchable document from an arbitrary JavaScript value. */
  function createSearchDocument(title, category, value) {
    const serializedValue = JSON.stringify(value, null, 2);

    return {
      title,
      category,
      content: serializedValue,
      normalizedContent: normalizeText(serializedValue)
    };
  }

  /* Build the complete local search index from the supplied system data. */
  function buildKnowledgeIndex() {
    const credentials = knowledgeBase.credentials || {};
    const architecture = knowledgeBase.architecture || {};

    knowledgeBase.searchDocuments = [
      createSearchDocument("Professional Profile", "profile", credentials.profile || {}),
      createSearchDocument("Institutions", "institutions", credentials.institutions || []),
      createSearchDocument("Disciplines", "disciplines", credentials.disciplines || []),
      createSearchDocument("Portfolio Projects", "projects", credentials.projects || []),
      createSearchDocument("Publications", "publications", credentials.publications || []),
      createSearchDocument("CV Versions", "cv_versions", credentials.cv_versions || []),
      createSearchDocument("System Architecture", "architecture", architecture),
      createSearchDocument("Professional Identity", "identity", PROFESSIONAL_IDENTITY)
    ];
  }

  /* Search the local knowledge graph and return the strongest matching records. */
  function searchKnowledge(query, maximumResults = 5) {
    return knowledgeBase.searchDocuments
      .map((document) => ({
        ...document,
        score: calculateSimilarity(query, document.normalizedContent)
      }))
      .filter((document) => document.score >= CONFIG.minimumSimilarityScore)
      .sort((first, second) => second.score - first.score)
      .slice(0, maximumResults);
  }

  /* Determine the user's requested reasoning mode from language cues. */
  function detectReasoningLenses(query) {
    const normalizedQuery = normalizeText(query);
    const detectedLenses = [];

    const lensSignals = {
      strategic: ["strategy", "strategic", "roadmap", "decision", "priority", "governance"],
      systems: ["system", "systems", "ecosystem", "interdependency", "feedback", "complexity"],
      futures: ["future", "futures", "scenario", "foresight", "horizon", "2030", "2035", "2050"],
      cognitive: ["cognitive", "behavior", "decision bias", "learning", "human behavior", "mental model"],
      physical: ["physics", "quantum", "entropy", "energy", "network", "complex adaptive"],
      resilience: ["resilience", "risk", "shock", "adaptation", "disaster", "climate"],
      innovation: ["innovation", "innovate", "platform", "digital", "ai", "technology", "transformation"]
    };

    Object.entries(lensSignals).forEach(([lens, signals]) => {
      if (signals.some((signal) => normalizedQuery.includes(signal))) {
        detectedLenses.push(lens);
      }
    });

    return detectedLenses.length ? detectedLenses : ["strategic", "systems"];
  }

  /* Detect the dominant conversational intent. */
  function detectIntent(query) {
    const normalizedQuery = normalizeText(query);

    if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(normalizedQuery)) {
      return "greeting";
    }

    if (/\b(who is|who are|profile|background|credentials|experience|cv|resume)\b/.test(normalizedQuery)) {
      return "profile";
    }

    if (/\b(portfolio|project|projects|publication|book|work)\b/.test(normalizedQuery)) {
      return "portfolio";
    }

    if (/\b(architecture|system architecture|modules|platforms|chorus|elektrametrics|electoral strategy|blog)\b/.test(normalizedQuery)) {
      return "architecture";
    }

    if (/\b(analy[sz]e|review|assess|evaluate|diagnose|audit)\b/.test(normalizedQuery)) {
      return "analysis";
    }

    if (/\b(recommend|recommendation|solution|solve|improve|innovate|design|propose)\b/.test(normalizedQuery)) {
      return "recommendation";
    }

    if (/\b(strategy|strategic plan|roadmap|priorit)\b/.test(normalizedQuery)) {
      return "strategy";
    }

    return "general";
  }

  /* Format professional profile facts for concise responses. */
  function createProfileResponse() {
    const profile = knowledgeBase.credentials?.profile || {};

    return [
      `<strong>${escapeHtml(profile.name || "Alvin M. Silva, MDM")}</strong>`,
      escapeHtml(PROFESSIONAL_IDENTITY.title),
      escapeHtml(PROFESSIONAL_IDENTITY.specialization),
      escapeHtml(PROFESSIONAL_IDENTITY.innovationRole),
      escapeHtml(PROFESSIONAL_IDENTITY.humanitarianCredential),
      "",
      `Experience: ${escapeHtml(profile.years_total || "almost two decades")} years`,
      `Geographic experience: ${escapeHtml(profile.countries || "multiple")} countries`,
      `Climate-smart funding designed: ${escapeHtml(profile.funding_designed || "documented portfolio value")}`,
      `Households reached: ${escapeHtml(profile.households_reached || "documented portfolio reach")}`,
      `Strategic plans facilitated: ${escapeHtml(profile.strategic_plans_facilitated || "multiple")}`,
      "",
      escapeHtml(PROFESSIONAL_IDENTITY.mission)
    ].join("<br>");
  }

  /* Extract portfolio records that best match a user query. */
  function findRelevantProjects(query) {
    const projects = knowledgeBase.credentials?.projects || [];

    return projects
      .map((project) => ({
        project,
        score: calculateSimilarity(query, JSON.stringify(project))
      }))
      .sort((first, second) => second.score - first.score)
      .filter((entry) => entry.score >= CONFIG.minimumSimilarityScore)
      .slice(0, 5)
      .map((entry) => entry.project);
  }

  /* Create a portfolio-focused answer from local data. */
  function createPortfolioResponse(query) {
    const relevantProjects = findRelevantProjects(query);

    if (!relevantProjects.length) {
      return "The local portfolio knowledge base does not identify a sufficiently strong match for that request. Try naming a project, sector, discipline, organization, or outcome.";
    }

    return [
      "<strong>Relevant portfolio evidence</strong>",
      ...relevantProjects.map((project) => {
        const year = project.year ? ` (${escapeHtml(project.year)})` : "";
        const funding = project.funding ? ` — ${escapeHtml(project.funding)}` : "";
        return `• <strong>${escapeHtml(project.name)}</strong>${year}${funding}<br>&nbsp;&nbsp;${escapeHtml((project.keywords || []).slice(0, 7).join(" · "))}`;
      })
    ].join("<br>");
  }

  /* Describe the planned and existing system architecture without inventing capabilities. */
  function createArchitectureResponse() {
    const architecture = knowledgeBase.architecture || {};

    const modules = architecture.modules || [];
    const capabilities = architecture.capabilities || [];

    return [
      "<strong>System architecture awareness</strong>",
      escapeHtml(architecture.description || "The assistant operates as a local knowledge and reasoning layer over the Alvin Silva platform ecosystem."),
      "",
      modules.length
        ? `<strong>Known modules</strong><br>${modules.map((module) => `• ${escapeHtml(module.name)} — ${escapeHtml(module.purpose)}`).join("<br>")}`
        : "",
      "",
      capabilities.length
        ? `<strong>Reasoning capabilities</strong><br>${capabilities.map((capability) => `• ${escapeHtml(capability)}`).join("<br>")}`
        : ""
    ].join("<br>");
  }

  /* Produce an explicit strategic reasoning frame rather than pretending to be a general-purpose artificial intelligence model. */
  function createReasoningResponse(query, intent, lenses, searchResults) {
    const lensNames = lenses.map((lens) => REASONING_LENSES[lens]).join(", ");

    const evidence = searchResults
      .slice(0, 3)
      .map((result) => `• ${escapeHtml(result.title)}`)
      .join("<br>");

    const response = [
      `<strong>Reasoning frame: ${escapeHtml(lensNames)}</strong>`,
      "",
      `<strong>1. Situation</strong><br>${escapeHtml(query)}`,
      "",
      "<strong>2. System diagnosis</strong><br>Identify actors, constraints, incentives, dependencies, feedback loops, second-order effects, and the measurable outcome that matters.",
      "",
      "<strong>3. Strategic choice</strong><br>Prioritize interventions that improve system conditions rather than optimizing one isolated component.",
      "",
      "<strong>4. Future test</strong><br>Stress-test the preferred option against alternative futures, shocks, unintended consequences, and implementation constraints.",
      "",
      "<strong>5. Action architecture</strong><br>Convert the recommendation into owners, decisions, resources, milestones, indicators, learning loops, and escalation triggers.",
      "",
      "<strong>Local evidence considered</strong>",
      evidence || "No sufficiently strong local evidence match was identified."
    ];

    if (lenses.includes("physical")) {
      response.push(
        "",
        "<strong>Scientific boundary</strong><br>Physical-science concepts can be used as disciplined analogies or analytical lenses. Quantum mechanics should not be presented as evidence for unsupported management, consciousness, or organizational claims."
      );
    }

    if (intent === "recommendation") {
      response.push(
        "",
        "<strong>Recommended next move</strong><br>Define the decision to be made, establish a baseline, map the system, identify leverage points, compare at least three intervention pathways, and select the option with the strongest balance of impact, feasibility, resilience, and learning value."
      );
    }

    return response.join("<br>");
  }

  /* Generate a useful response entirely from local data and deterministic reasoning rules. */
  function generateResponse(query) {
    const intent = detectIntent(query);
    const lenses = detectReasoningLenses(query);
    const searchResults = searchKnowledge(query);

    if (intent === "greeting") {
      return `Hello. I am the ASilva Intelligent Assistant. I am designed around Alvin Silva's professional profile, credentials, portfolio, and system architecture. I can help you explore his work, analyze a problem, review a strategy, or develop an innovation pathway.`;
    }

    if (intent === "profile") {
      return createProfileResponse();
    }

    if (intent === "portfolio") {
      return createPortfolioResponse(query);
    }

    if (intent === "architecture") {
      return createArchitectureResponse();
    }

    return createReasoningResponse(query, intent, lenses, searchResults);
  }

  /* Persist the conversation locally so the assistant can maintain short-term continuity. */
  function persistConversation() {
    localStorage.setItem(CONFIG.widgetStorageKey, JSON.stringify(conversationState));
  }

  /* Restore the previous short conversation when possible. */
  function restoreConversation() {
    try {
      const savedState = JSON.parse(localStorage.getItem(CONFIG.widgetStorageKey) || "null");

      if (savedState && Array.isArray(savedState.messages)) {
        conversationState = {
          messages: savedState.messages.slice(-CONFIG.maximumHistoryMessages)
        };
      }
    } catch (error) {
      conversationState = { messages: [] };
    }
  }

  /* Add one message to the local conversation history. */
  function addMessage(role, content) {
    conversationState.messages.push({
      role,
      content,
      timestamp: Date.now()
    });

    conversationState.messages = conversationState.messages.slice(-CONFIG.maximumHistoryMessages);
    persistConversation();
  }

  /* Create the visual widget shell. */
  function createWidget() {
    const container = document.createElement("aside");

    container.className = "asilva-intelligent-widget";
    container.setAttribute("aria-label", "ASilva Intelligent Assistant");

    container.innerHTML = `
      <button class="asilva-intelligent-trigger" type="button" aria-expanded="false" aria-controls="asilva-intelligent-panel">
        <img src="${escapeHtml(CONFIG.logoPath)}" alt="ASilva Assistant">
        <span class="asilva-intelligent-tooltip">Ask ASilva Intelligent Assistant</span>
      </button>
      <section class="asilva-intelligent-panel" id="asilva-intelligent-panel" aria-hidden="true">
        <header class="asilva-intelligent-header">
          <img src="${escapeHtml(CONFIG.logoPath)}" alt="Alvin Silva" class="asilva-intelligent-avatar">
          <div class="asilva-intelligent-header-copy">
            <strong>ASilva Intelligent Assistant</strong>
            <span>Local knowledge · Strategic reasoning · Systems thinking</span>
          </div>
          <button class="asilva-intelligent-close" type="button" aria-label="Close assistant">×</button>
        </header>
        <div class="asilva-intelligent-messages" aria-live="polite"></div>
        <div class="asilva-intelligent-suggestions">
          <button type="button" data-question="Who is Alvin Silva?">Profile</button>
          <button type="button" data-question="What are Alvin's strongest portfolio projects?">Portfolio</button>
          <button type="button" data-question="How does the system architecture work?">Architecture</button>
          <button type="button" data-question="Analyze this problem using systems and strategic thinking.">Analyze</button>
        </div>
        <form class="asilva-intelligent-input">
          <input type="text" autocomplete="off" placeholder="Ask about Alvin, his work, or a strategic problem…" aria-label="Message">
          <button type="submit" aria-label="Send message">➤</button>
        </form>
        <div class="asilva-intelligent-disclaimer">Local reasoning assistant. No external artificial-intelligence service or API key is required.</div>
      </section>
    `;

    document.body.appendChild(container);
    return container;
  }

  /* Inject the assistant's visual design without changing the site's global theme. */
  function injectStyles() {
    const style = document.createElement("style");

    style.textContent = `
      .asilva-intelligent-widget {
        position: fixed;
        right: 1.2rem;
        bottom: 1.2rem;
        z-index: 2000;
        font-family: "Poppins", system-ui, sans-serif;
      }

      .asilva-intelligent-trigger {
        position: relative;
        width: 60px;
        height: 60px;
        padding: 0;
        border: 3px solid #FFD700;
        border-radius: 50%;
        overflow: hidden;
        background: #fff;
        cursor: pointer;
        box-shadow: 0 8px 32px rgba(0, 0, 0, .35);
        transition: transform .25s ease, box-shadow .25s ease;
      }

      .asilva-intelligent-trigger:hover {
        transform: scale(1.06);
        box-shadow: 0 12px 40px rgba(255, 215, 0, .28);
      }

      .asilva-intelligent-trigger img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .asilva-intelligent-tooltip {
        position: absolute;
        right: 70px;
        top: 50%;
        width: max-content;
        padding: .45rem .8rem;
        border: 1px solid rgba(10, 20, 60, .16);
        border-radius: 9px;
        background: #fff;
        color: #0d1224;
        font-size: .74rem;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-50%);
        transition: .2s ease;
        pointer-events: none;
      }

      .asilva-intelligent-trigger:hover .asilva-intelligent-tooltip {
        opacity: 1;
        visibility: visible;
      }

      .asilva-intelligent-panel {
        position: absolute;
        right: 0;
        bottom: 74px;
        display: flex;
        width: min(430px, calc(100vw - 1.6rem));
        height: min(640px, calc(100vh - 110px));
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(255, 215, 0, .28);
        border-radius: 20px;
        background: linear-gradient(135deg, rgba(255, 255, 255, .97), rgba(240, 244, 252, .94));
        box-shadow: 0 18px 48px rgba(20, 30, 60, .18);
        backdrop-filter: blur(24px) saturate(180%);
        opacity: 0;
        visibility: hidden;
        transform: translateY(12px) scale(.97);
        transition: .3s ease;
      }

      .asilva-intelligent-panel.open {
        opacity: 1;
        visibility: visible;
        transform: none;
      }

      .asilva-intelligent-header {
        display: flex;
        align-items: center;
        gap: .7rem;
        padding: .9rem 1rem;
        border-bottom: 1px solid rgba(10, 20, 60, .12);
        background: linear-gradient(135deg, rgba(255, 215, 0, .09), rgba(0, 105, 168, .06));
      }

      .asilva-intelligent-avatar {
        width: 42px;
        height: 42px;
        flex: none;
        border: 2px solid #FFD700;
        border-radius: 50%;
        object-fit: cover;
        background: #fff;
      }

      .asilva-intelligent-header-copy {
        display: flex;
        min-width: 0;
        flex: 1;
        flex-direction: column;
      }

      .asilva-intelligent-header-copy strong {
        color: #0d1224;
        font-family: "Montserrat", system-ui, sans-serif;
        font-size: .9rem;
      }

      .asilva-intelligent-header-copy span {
        color: rgba(20, 26, 46, .68);
        font-family: "Roboto Condensed", system-ui, sans-serif;
        font-size: .68rem;
      }

      .asilva-intelligent-close {
        width: 32px;
        height: 32px;
        border: 1px solid rgba(10, 20, 60, .15);
        border-radius: 50%;
        background: rgba(90, 110, 160, .08);
        color: #0d1224;
        cursor: pointer;
        font-size: 1.1rem;
      }

      .asilva-intelligent-messages {
        display: flex;
        min-height: 0;
        flex: 1;
        flex-direction: column;
        gap: .7rem;
        overflow-y: auto;
        padding: 1rem;
      }

      .asilva-intelligent-message {
        max-width: 94%;
        padding: .75rem .9rem;
        border-radius: 13px;
        color: #0d1224;
        font-size: .84rem;
        line-height: 1.62;
      }

      .asilva-intelligent-message.assistant {
        align-self: flex-start;
        border: 1px solid rgba(10, 20, 60, .12);
        border-bottom-left-radius: 4px;
        background: rgba(90, 110, 160, .08);
      }

      .asilva-intelligent-message.user {
        align-self: flex-end;
        border-bottom-right-radius: 4px;
        background: linear-gradient(135deg, #0057c2, #0069a8);
        color: #fff;
      }

      .asilva-intelligent-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: .4rem;
        padding: .55rem .75rem;
        border-top: 1px solid rgba(10, 20, 60, .08);
      }

      .asilva-intelligent-suggestions button {
        padding: .38rem .65rem;
        border: 1px solid rgba(10, 20, 60, .15);
        border-radius: 999px;
        background: rgba(90, 110, 160, .07);
        color: #0d1224;
        cursor: pointer;
        font: 600 .7rem "Roboto Condensed", system-ui, sans-serif;
      }

      .asilva-intelligent-suggestions button:hover {
        border-color: #8a6d00;
        background: rgba(255, 215, 0, .09);
      }

      .asilva-intelligent-input {
        display: flex;
        gap: .5rem;
        padding: .7rem .8rem;
        border-top: 1px solid rgba(10, 20, 60, .12);
      }

      .asilva-intelligent-input input {
        min-width: 0;
        flex: 1;
        padding: .68rem .9rem;
        border: 1px solid rgba(10, 20, 60, .18);
        border-radius: 999px;
        background: rgba(255, 255, 255, .9);
        color: #0d1224;
        outline: none;
        font: .82rem "Poppins", system-ui, sans-serif;
      }

      .asilva-intelligent-input input:focus {
        border-color: #0069a8;
        box-shadow: 0 0 0 3px rgba(0, 105, 168, .12);
      }

      .asilva-intelligent-input button {
        width: 42px;
        height: 42px;
        flex: none;
        border: 0;
        border-radius: 50%;
        background: linear-gradient(135deg, #0057c2, #0069a8);
        color: #fff;
        cursor: pointer;
      }

      .asilva-intelligent-disclaimer {
        padding: .4rem .8rem .55rem;
        color: rgba(20, 26, 46, .58);
        font-size: .61rem;
        text-align: center;
      }

      @media (prefers-color-scheme: dark) {
        .asilva-intelligent-panel {
          border-color: rgba(255, 215, 0, .25);
          background: linear-gradient(135deg, rgba(10, 20, 60, .97), rgba(10, 14, 39, .97));
        }

        .asilva-intelligent-header-copy strong,
        .asilva-intelligent-close,
        .asilva-intelligent-suggestions button,
        .asilva-intelligent-message {
          color: #fff;
        }

        .asilva-intelligent-header,
        .asilva-intelligent-input,
        .asilva-intelligent-suggestions {
          border-color: rgba(255, 255, 255, .1);
        }

        .asilva-intelligent-header-copy span,
        .asilva-intelligent-disclaimer {
          color: rgba(224, 230, 237, .64);
        }

        .asilva-intelligent-message.assistant {
          border-color: rgba(255, 255, 255, .1);
          background: rgba(255, 255, 255, .06);
        }

        .asilva-intelligent-input input {
          border-color: rgba(255, 255, 255, .14);
          background: rgba(10, 16, 42, .8);
          color: #fff;
        }
      }

      @media (max-width: 520px) {
        .asilva-intelligent-widget {
          right: .8rem;
          bottom: .8rem;
        }

        .asilva-intelligent-panel {
          right: -.8rem;
          bottom: 70px;
          width: calc(100vw - 1.6rem);
          height: min(680px, calc(100vh - 90px));
          border-radius: 18px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* Render one message safely. */
  function renderMessage(messagesElement, role, content, alreadyFormatted = false) {
    const messageElement = document.createElement("div");

    messageElement.className = `asilva-intelligent-message ${role}`;

    if (alreadyFormatted) {
      messageElement.innerHTML = content;
    } else {
      messageElement.innerHTML = escapeHtml(content).replace(/\n/g, "<br>");
    }

    messagesElement.appendChild(messageElement);
    messagesElement.scrollTop = messagesElement.scrollHeight;
  }

  /* Send a user question through the local reasoning engine. */
  function handleQuestion(question, messagesElement, inputElement) {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) return;

    renderMessage(messagesElement, "user", trimmedQuestion);
    addMessage("user", trimmedQuestion);

    inputElement.value = "";

    const response = generateResponse(trimmedQuestion);

    window.setTimeout(() => {
      renderMessage(messagesElement, "assistant", response, true);
      addMessage("assistant", response);
    }, 180);
  }

  /* Restore visible messages after creating the widget. */
  function renderConversation(messagesElement) {
    messagesElement.innerHTML = "";

    if (!conversationState.messages.length) {
      renderMessage(
        messagesElement,
        "assistant",
        "Hello. I am the ASilva Intelligent Assistant.<br><br>I work from Alvin Silva's local professional knowledge base and system architecture. Ask me about his credentials, portfolio, strategy work, resilience practice, systems innovation, or give me a problem to analyze.",
        true
      );
      return;
    }

    conversationState.messages.forEach((message) => {
      renderMessage(messagesElement, message.role, message.content, message.role === "assistant");
    });
  }

  /* Load local knowledge resources. */
  async function loadKnowledge() {
    const [credentialsResponse, architectureResponse] = await Promise.all([
      fetch(CONFIG.credentialsPath, { cache: "no-store" }),
      fetch(CONFIG.architecturePath, { cache: "no-store" })
    ]);

    if (!credentialsResponse.ok) {
      throw new Error(`Unable to load credentials.json: HTTP ${credentialsResponse.status}`);
    }

    if (!architectureResponse.ok) {
      throw new Error(`Unable to load system architecture: HTTP ${architectureResponse.status}`);
    }

    knowledgeBase.credentials = await credentialsResponse.json();
    knowledgeBase.architecture = await architectureResponse.json();

    buildKnowledgeIndex();
  }

  /* Initialize the assistant after the page has loaded. */
  async function initialize() {
    restoreConversation();
    injectStyles();

    const widget = createWidget();
    const trigger = widget.querySelector(".asilva-intelligent-trigger");
    const panel = widget.querySelector(".asilva-intelligent-panel");
    const closeButton = widget.querySelector(".asilva-intelligent-close");
    const messagesElement = widget.querySelector(".asilva-intelligent-messages");
    const inputForm = widget.querySelector(".asilva-intelligent-input");
    const inputElement = inputForm.querySelector("input");

    try {
      await loadKnowledge();
      renderConversation(messagesElement);
    } catch (error) {
      renderMessage(
        messagesElement,
        "assistant",
        "The local knowledge files could not be loaded. Please serve this site through HTTP or HTTPS rather than opening the HTML file directly.",
        false
      );
      console.error("[ASilva Intelligent Assistant]", error);
    }

    function openPanel() {
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      trigger.setAttribute("aria-expanded", "true");
      inputElement.focus();
    }

    function closePanel() {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
      trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", () => {
      panel.classList.contains("open") ? closePanel() : openPanel();
    });

    closeButton.addEventListener("click", closePanel);

    inputForm.addEventListener("submit", (event) => {
      event.preventDefault();
      handleQuestion(inputElement.value, messagesElement, inputElement);
    });

    widget.querySelectorAll("[data-question]").forEach((button) => {
      button.addEventListener("click", () => {
        handleQuestion(button.dataset.question || "", messagesElement, inputElement);
      });
    });
  }

  /* Start after the document is ready. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
