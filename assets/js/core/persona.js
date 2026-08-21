/**
 * Alvin Silva Platform — Persona Core.
 * Controls audience-aware presentation while preserving one professional identity.
 * Supported audiences: government, humanitarian, private, and academic.
 */
(function () {
  "use strict";

  /* Prevent duplicate initialization. */
  if (window.ASilvaPersona) return;

  /* Define supported professional audience personas. */
  const PERSONAS = {
    government: {
      label: "Government & Policy",
      description:
        "Strategic planning, policy research, institutional strengthening, governance, resilience, and public-sector transformation.",
      emphasis: [
        "strategic planning",
        "policy alignment",
        "institutional strengthening",
        "governance outcomes",
        "long-term resilience"
      ]
    },
    humanitarian: {
      label: "Humanitarian & Development",
      description:
        "Disaster risk reduction, climate adaptation, humanitarian action, community resilience, livelihoods, and conflict-sensitive programming.",
      emphasis: [
        "DRR and CCA",
        "community resilience",
        "humanitarian practice",
        "livelihoods",
        "capacity development"
      ]
    },
    private: {
      label: "Private Sector",
      description:
        "Sustainability, organizational development, systems innovation, resilience strategy, digital transformation, and cross-sector partnerships.",
      emphasis: [
        "business resilience",
        "systems innovation",
        "organizational performance",
        "sustainability",
        "strategic growth"
      ]
    },
    academic: {
      label: "Academic & Research",
      description:
        "Research, knowledge development, systems thinking, evaluation, applied learning, and evidence-informed practice.",
      emphasis: [
        "research",
        "evidence",
        "systems thinking",
        "evaluation",
        "knowledge development"
      ]
    }
  };

  /* Store persona state. */
  const ASilvaPersona = {
    storageKey: "as-persona",
    defaultPersona: "private",
    currentPersona: "private",
    initialized: false
  };

  /* Return the first valid persona or the configured default. */
  function normalizePersona(personaName) {
    return Object.prototype.hasOwnProperty.call(PERSONAS, personaName)
      ? personaName
      : ASilvaPersona.defaultPersona;
  }

  /* Read the persona from document metadata, storage, or the default. */
  function determineInitialPersona() {
    const documentPersona =
      document.documentElement.dataset.persona ||
      document.body?.dataset.persona ||
      "";

    const storedPersona = (() => {
      try {
        return localStorage.getItem(ASilvaPersona.storageKey) || "";
      } catch (error) {
        return "";
      }
    })();

    return normalizePersona(documentPersona || storedPersona);
  }

  /* Update all persona-related document state. */
  function applyPersona(personaName, persist = true) {
    const normalizedPersona = normalizePersona(personaName);

    ASilvaPersona.currentPersona = normalizedPersona;

    document.documentElement.dataset.persona = normalizedPersona;

    if (document.body) {
      document.body.dataset.persona = normalizedPersona;
    }

    document.documentElement.setAttribute(
      "data-persona-label",
      PERSONAS[normalizedPersona].label
    );

    document.querySelectorAll("[data-persona-content]").forEach(function (
      element
    ) {
      const allowedPersonas = String(
        element.dataset.personaContent || ""
      )
        .split(",")
        .map(function (value) {
          return value.trim();
        })
        .filter(Boolean);

      const shouldShow =
        !allowedPersonas.length || allowedPersonas.includes(normalizedPersona);

      element.hidden = !shouldShow;
      element.setAttribute("aria-hidden", String(!shouldShow));
    });

    document.querySelectorAll("[data-persona]").forEach(function (element) {
      const elementPersona = element.dataset.persona;

      if (elementPersona === normalizedPersona) {
        element.classList.add("is-active");
        element.setAttribute("aria-current", "true");
      } else if (element !== document.body) {
        element.classList.remove("is-active");

        if (element.hasAttribute("aria-current")) {
          element.removeAttribute("aria-current");
        }
      }
    });

    document.querySelectorAll("[data-persona-value]").forEach(function (
      element
    ) {
      const valueKey = element.dataset.personaValue;

      if (valueKey === "label") {
        element.textContent = PERSONAS[normalizedPersona].label;
      }

      if (valueKey === "description") {
        element.textContent = PERSONAS[normalizedPersona].description;
      }
    });

    if (persist) {
      try {
        localStorage.setItem(
          ASilvaPersona.storageKey,
          normalizedPersona
        );
      } catch (error) {
        /* Continue when local storage is unavailable. */
      }
    }

    document.dispatchEvent(
      new CustomEvent("asilva:persona-change", {
        detail: {
          persona: normalizedPersona,
          profile: PERSONAS[normalizedPersona]
        }
      })
    );
  }

  /* Bind persona selector buttons and accessible controls. */
  function initializeSelectors() {
    document.addEventListener("click", function (clickEvent) {
      const selector = clickEvent.target.closest("[data-set-persona]");

      if (!selector) return;

      clickEvent.preventDefault();
      applyPersona(selector.dataset.setPersona);
    });

    document.addEventListener("change", function (changeEvent) {
      const selector = changeEvent.target.closest("[data-persona-selector]");

      if (!selector) return;

      applyPersona(selector.value);
    });
  }

  /* Allow persona changes from keyboard-accessible custom buttons. */
  function initializeKeyboardSupport() {
    document.addEventListener("keydown", function (keyboardEvent) {
      const selector = keyboardEvent.target.closest("[data-set-persona]");

      if (!selector) return;

      if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
        keyboardEvent.preventDefault();
        applyPersona(selector.dataset.setPersona);
      }
    });
  }

  /* Expose persona state and controls to the rest of the application. */
  ASilvaPersona.get = function () {
    return ASilvaPersona.currentPersona;
  };

  ASilvaPersona.getProfile = function (personaName) {
    return PERSONAS[normalizePersona(personaName)];
  };

  ASilvaPersona.getAll = function () {
    return { ...PERSONAS };
  };

  ASilvaPersona.set = function (personaName) {
    applyPersona(personaName);
  };

  /* Initialize persona behavior. */
  ASilvaPersona.init = function () {
    if (ASilvaPersona.initialized) return;

    ASilvaPersona.currentPersona = determineInitialPersona();
    applyPersona(ASilvaPersona.currentPersona, false);
    initializeSelectors();
    initializeKeyboardSupport();

    ASilvaPersona.initialized = true;
  };

  /* Publish the persona module globally. */
  window.ASilvaPersona = ASilvaPersona;

  /* Initialize when the document is ready. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ASilvaPersona.init, {
      once: true
    });
  } else {
    ASilvaPersona.init();
  }
})();
