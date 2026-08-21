/* Alvin Silva Platform: privacy-aware first-party analytics service. */
(function () {
  "use strict";

  /* Avoid registering the service more than once. */
  if (window.ASilvaAnalyticsService) return;

  /* Keep analytics configuration deliberately minimal. */
  const configuration = {
    storageKey: "asilva-analytics-events-v1",
    endpoint: "",
    enabled: true,
    maximumEvents: 250
  };

  /* Read locally stored anonymous events. */
  function readEvents() {
    try {
      const events = JSON.parse(
        localStorage.getItem(configuration.storageKey) || "[]"
      );
      return Array.isArray(events) ? events : [];
    } catch (error) {
      return [];
    }
  }

  /* Persist a bounded event history. */
  function writeEvents(events) {
    try {
      localStorage.setItem(
        configuration.storageKey,
        JSON.stringify(events.slice(-configuration.maximumEvents))
      );
    } catch (error) {
      /* Analytics must never break the website. */
    }
  }

  /* Record one non-sensitive interaction. */
  function track(eventName, properties) {
    if (!configuration.enabled) return;

    const event = {
      id:
        "event-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2, 9),
      name: String(eventName || "unknown"),
      timestamp: new Date().toISOString(),
      path: window.location.pathname,
      properties: properties && typeof properties === "object"
        ? { ...properties }
        : {}
    };

    const events = readEvents();
    events.push(event);
    writeEvents(events);

    if (configuration.endpoint && navigator.onLine) {
      fetch(configuration.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(event),
        keepalive: true
      }).catch(function () {
        /* Remote analytics failure is intentionally ignored. */
      });
    }
  }

  /* Configure an optional first-party endpoint. */
  function configure(options) {
    const safeOptions = options || {};

    if (typeof safeOptions.endpoint === "string") {
      configuration.endpoint = safeOptions.endpoint.trim();
    }

    if (typeof safeOptions.enabled === "boolean") {
      configuration.enabled = safeOptions.enabled;
    }
  }

  /* Return local analytics events for diagnostics or export. */
  function getLocalEvents() {
    return readEvents();
  }

  /* Remove all locally stored analytics events. */
  function clearLocalEvents() {
    try {
      localStorage.removeItem(configuration.storageKey);
    } catch (error) {
      /* Storage is optional. */
    }
  }

  /* Track only anonymous UI-state changes. */
  document.addEventListener("asilva:persona-change", function (event) {
    if (event.detail && event.detail.persona) {
      track("persona_changed", { persona: event.detail.persona });
    }
  });

  /* Track only the selected visual theme. */
  document.addEventListener("asilva:theme-change", function (event) {
    if (event.detail && event.detail.theme) {
      track("theme_changed", { theme: event.detail.theme });
    }
  });

  /* Publish the analytics API. */
  window.ASilvaAnalyticsService = {
    track,
    configure,
    getLocalEvents,
    clearLocalEvents
  };
})();