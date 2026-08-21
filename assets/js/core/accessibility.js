/**
 * Alvin Silva Platform — Accessibility Core.
 * Provides keyboard navigation, reduced-motion preferences, focus management,
 * accessible disclosure controls, and optional accessibility preference persistence.
 */
(function () {
  "use strict";

  /* Prevent duplicate initialization. */
  if (window.ASilvaAccessibility) return;

  /* Store the public module API. */
  const ASilvaAccessibility = {
    storageKey: "asilva-accessibility-preferences",
    initialized: false,
    preferences: {
      reducedMotion: false,
      highContrast: false,
      largerText: false
    }
  };

  /* Safely parse persisted accessibility preferences. */
  function loadPreferences() {
    try {
      const storedPreferences = JSON.parse(
        localStorage.getItem(ASilvaAccessibility.storageKey) || "{}"
      );

      ASilvaAccessibility.preferences = {
        ...ASilvaAccessibility.preferences,
        ...storedPreferences
      };
    } catch (error) {
      /* Continue with defaults when storage is unavailable or invalid. */
    }
  }

  /* Persist accessibility preferences without allowing storage errors to break the page. */
  function savePreferences() {
    try {
      localStorage.setItem(
        ASilvaAccessibility.storageKey,
        JSON.stringify(ASilvaAccessibility.preferences)
      );
    } catch (error) {
      /* Continue normally when storage is unavailable. */
    }
  }

  /* Apply the accessibility preference state to the document. */
  function applyPreferences() {
    const rootElement = document.documentElement;

    rootElement.classList.toggle(
      "as-reduced-motion",
      Boolean(ASilvaAccessibility.preferences.reducedMotion)
    );

    rootElement.classList.toggle(
      "as-high-contrast",
      Boolean(ASilvaAccessibility.preferences.highContrast)
    );

    rootElement.classList.toggle(
      "as-larger-text",
      Boolean(ASilvaAccessibility.preferences.largerText)
    );

    rootElement.dataset.reducedMotion = String(
      Boolean(ASilvaAccessibility.preferences.reducedMotion)
    );

    rootElement.dataset.highContrast = String(
      Boolean(ASilvaAccessibility.preferences.highContrast)
    );

    rootElement.dataset.largerText = String(
      Boolean(ASilvaAccessibility.preferences.largerText)
    );
  }

  /* Update one preference and persist the resulting state. */
  function setPreference(preferenceName, preferenceValue) {
    if (!(preferenceName in ASilvaAccessibility.preferences)) return;

    ASilvaAccessibility.preferences[preferenceName] = Boolean(preferenceValue);
    applyPreferences();
    savePreferences();
  }

  /* Make every keyboard-focusable element visibly identifiable. */
  function initializeFocusVisibility() {
    document.addEventListener(
      "keydown",
      function (keyboardEvent) {
        if (keyboardEvent.key === "Tab") {
          document.documentElement.classList.add("as-keyboard-navigation");
        }
      },
      { passive: true }
    );

    document.addEventListener(
      "mousedown",
      function () {
        document.documentElement.classList.remove("as-keyboard-navigation");
      },
      { passive: true }
    );
  }

  /* Make skip links work even when custom scrolling is used by the page. */
  function initializeSkipLinks() {
    document.addEventListener("click", function (clickEvent) {
      const clickedElement = clickEvent.target.closest(
        'a[href^="#"], button[data-scroll-target]'
      );

      if (!clickedElement) return;

      const targetSelector =
        clickedElement.getAttribute("href") ||
        clickedElement.dataset.scrollTarget;

      if (!targetSelector || targetSelector === "#") return;

      let targetElement;

      try {
        targetElement = document.querySelector(targetSelector);
      } catch (error) {
        return;
      }

      if (!targetElement) return;

      clickEvent.preventDefault();

      targetElement.setAttribute("tabindex", "-1");
      targetElement.scrollIntoView({
        behavior: ASilvaAccessibility.preferences.reducedMotion
          ? "auto"
          : "smooth",
        block: "start"
      });

      window.setTimeout(function () {
        targetElement.focus({ preventScroll: true });
      }, ASilvaAccessibility.preferences.reducedMotion ? 0 : 250);
    });
  }

  /* Add robust keyboard support to common custom disclosure controls. */
  function initializeDisclosureControls() {
    document.addEventListener("click", function (clickEvent) {
      const triggerElement = clickEvent.target.closest(
        "[data-accessibility-toggle], [data-disclosure-target]"
      );

      if (!triggerElement) return;

      const targetSelector =
        triggerElement.dataset.disclosureTarget ||
        triggerElement.dataset.accessibilityToggle;

      if (!targetSelector) return;

      let targetElement;

      try {
        targetElement = document.querySelector(targetSelector);
      } catch (error) {
        return;
      }

      if (!targetElement) return;

      const isOpen =
        targetElement.classList.contains("open") ||
        targetElement.hidden === false;

      const nextState = !isOpen;

      targetElement.hidden = !nextState;
      targetElement.classList.toggle("open", nextState);
      triggerElement.setAttribute("aria-expanded", String(nextState));
    });
  }

  /* Respect the operating system reduced-motion preference on first load. */
  function initializeSystemPreferences() {
    const reducedMotionQuery = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

    if (
      reducedMotionQuery &&
      reducedMotionQuery.matches &&
      !Object.prototype.hasOwnProperty.call(
        JSON.parse(
          localStorage.getItem(ASilvaAccessibility.storageKey) || "{}"
        ),
        "reducedMotion"
      )
    ) {
      ASilvaAccessibility.preferences.reducedMotion = true;
    }

    if (reducedMotionQuery && reducedMotionQuery.addEventListener) {
      reducedMotionQuery.addEventListener("change", function (event) {
        if (event.matches) {
          setPreference("reducedMotion", true);
        }
      });
    }
  }

  /* Expose preference controls to other modules and the browser console. */
  ASilvaAccessibility.setPreference = setPreference;
  ASilvaAccessibility.getPreferences = function () {
    return { ...ASilvaAccessibility.preferences };
  };

  /* Initialize the accessibility system exactly once. */
  ASilvaAccessibility.init = function () {
    if (ASilvaAccessibility.initialized) return;

    loadPreferences();
    initializeSystemPreferences();
    applyPreferences();
    initializeFocusVisibility();
    initializeSkipLinks();
    initializeDisclosureControls();

    ASilvaAccessibility.initialized = true;
  };

  /* Publish the module globally for other site modules. */
  window.ASilvaAccessibility = ASilvaAccessibility;

  /* Initialize after the document is ready. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ASilvaAccessibility.init, {
      once: true
    });
  } else {
    ASilvaAccessibility.init();
  }
})();
