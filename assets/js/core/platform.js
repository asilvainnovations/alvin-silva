/**
 * Alvin Silva Professional Platform — Core Orchestrator.
 * Coordinates the reusable browser modules without duplicating their responsibilities.
 * This module intentionally contains no professional credentials or business logic.
 * Professional knowledge belongs in the canonical credentials and knowledge-layer files.
 */
(function () {
  "use strict";

  /* Prevent the platform orchestrator from being initialized more than once. */
  if (window.ASilvaPlatform) return;

  /* Define the public platform controller. */
  const ASilvaPlatform = {
    initialized: false,
    version: "1.0.0",
    modules: {
      accessibility: false,
      navigation: false,
      persona: false,
      theme: false
    }
  };

  /* Safely initialize one registered core module. */
  function initializeModule(moduleName, moduleReference) {
    /* Confirm that the module exists before attempting initialization. */
    if (!moduleReference) return false;

    /* Confirm that the module exposes an initialization method. */
    if (typeof moduleReference.init !== "function") return false;

    try {
      /* Initialize the module while allowing it to remain independently responsible for its behavior. */
      moduleReference.init();

      /* Record successful initialization. */
      ASilvaPlatform.modules[moduleName] = true;

      /* Return success to the orchestrator. */
      return true;
    } catch (error) {
      /* Record the failure without preventing the remaining modules from loading. */
      console.error(
        `[ASilvaPlatform] Unable to initialize ${moduleName}.`,
        error
      );

      /* Return failure status. */
      return false;
    }
  }

  /* Publish a unified platform status object. */
  function getStatus() {
    return {
      version: ASilvaPlatform.version,
      initialized: ASilvaPlatform.initialized,
      modules: {
        ...ASilvaPlatform.modules
      },
      persona:
        typeof window.ASilvaPersona?.get === "function"
          ? window.ASilvaPersona.get()
          : null,
      theme:
        typeof window.ASilvaTheme?.get === "function"
          ? window.ASilvaTheme.get()
          : null
    };
  }

  /* Initialize all currently available core modules. */
  ASilvaPlatform.init = function () {
    /* Prevent duplicate initialization. */
    if (ASilvaPlatform.initialized) return getStatus();

    /* Initialize the accessibility subsystem. */
    initializeModule("accessibility", window.ASilvaAccessibility);

    /* Initialize the navigation subsystem. */
    initializeModule("navigation", window.ASilvaNavigation);

    /* Initialize the persona subsystem. */
    initializeModule("persona", window.ASilvaPersona);

    /* Initialize the theme subsystem. */
    initializeModule("theme", window.ASilvaTheme);

    /* Mark the orchestrator as initialized. */
    ASilvaPlatform.initialized = true;

    /* Notify future modules that the core platform is ready. */
    document.dispatchEvent(
      new CustomEvent("asilva:platform-ready", {
        detail: getStatus()
      })
    );

    /* Return the resulting platform status. */
    return getStatus();
  };

  /* Expose the current platform status. */
  ASilvaPlatform.getStatus = getStatus;

  /* Expose the active professional audience persona. */
  ASilvaPlatform.getPersona = function () {
    return typeof window.ASilvaPersona?.get === "function"
      ? window.ASilvaPersona.get()
      : "private";
  };

  /* Expose the current visual theme. */
  ASilvaPlatform.getTheme = function () {
    return typeof window.ASilvaTheme?.getResolved === "function"
      ? window.ASilvaTheme.getResolved()
      : "light";
  };

  /* Allow future modules to subscribe to platform readiness. */
  ASilvaPlatform.onReady = function (callbackFunction) {
    /* Ignore invalid callbacks. */
    if (typeof callbackFunction !== "function") return;

    /* Execute immediately when the platform is already ready. */
    if (ASilvaPlatform.initialized) {
      callbackFunction(getStatus());
      return;
    }

    /* Otherwise wait for the platform-ready event. */
    document.addEventListener(
      "asilva:platform-ready",
      function (event) {
        callbackFunction(event.detail);
      },
      { once: true }
    );
  };

  /* Publish the platform controller globally. */
  window.ASilvaPlatform = ASilvaPlatform;

  /* Initialize after the document has become available. */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      ASilvaPlatform.init,
      { once: true }
    );
  } else {
    ASilvaPlatform.init();
  }
})();
