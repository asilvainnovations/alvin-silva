/**
 * Alvin Silva Professional Platform — Core Entry Point.
 * Provides one predictable entry point for the core browser modules.
 * Individual modules remain independently reusable.
 */

/* Load the platform orchestrator when this entry point is included. */
(function () {
  "use strict";

  /* Prevent duplicate execution. */
  if (window.__ASILVA_CORE_ENTRY__) return;

  /* Record that the entry point has been loaded. */
  window.__ASILVA_CORE_ENTRY__ = true;

  /* Announce that the core entry point is available. */
  document.dispatchEvent(
    new CustomEvent("asilva:core-loaded", {
      detail: {
        message: "ASilva core browser modules are available."
      }
    })
  );
})();
