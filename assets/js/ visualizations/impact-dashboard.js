/* Alvin Silva Platform: evidence-based professional impact dashboard. */
(function () {
  "use strict";

  /* Avoid duplicate initialization. */
  if (window.ASilvaImpactDashboard) return;

  /* Escape displayed values safely. */
  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = String(value == null ? "" : value);
    return element.innerHTML;
  }

  /* Format documented numeric values for Philippine audiences. */
  function formatValue(value) {
    if (value === null || value === undefined || value === "") {
      return "Not documented";
    }

    return typeof value === "number"
      ? new Intl.NumberFormat("en-PH").format(value)
      : String(value);
  }

  /* Return the first documented value among possible schema names. */
  function firstAvailable(profile, keys) {
    for (const key of keys) {
      if (
        profile &&
        profile[key] !== undefined &&
        profile[key] !== null &&
        profile[key] !== ""
      ) {
        return profile[key];
      }
    }

    return null;
  }

  /* Build metrics without fabricating unavailable evidence. */
  function createMetrics(profile, projects) {
    return [
      {
        label: "Years of experience",
        value: firstAvailable(profile, [
          "years_total",
          "years",
          "experience_years"
        ]),
        description: "Documented professional experience."
      },
      {
        label: "Countries",
        value: firstAvailable(profile, [
          "countries",
          "countries_count",
          "geographic_reach"
        ]),
        description: "Documented geographic reach."
      },
      {
        label: "Households reached",
        value: firstAvailable(profile, [
          "households_reached",
          "households",
          "beneficiaries"
        ]),
        description: "Documented household or beneficiary reach."
      },
      {
        label: "Climate-smart funding",
        value: firstAvailable(profile, [
          "funding_designed",
          "funding",
          "climate_smart_funding"
        ]),
        description: "Documented funding designed or mobilized."
      },
      {
        label: "Strategic plans",
        value: firstAvailable(profile, [
          "strategic_plans_facilitated",
          "strategic_plans",
          "plans_facilitated"
        ]),
        description: "Documented strategic planning engagements."
      },
      {
        label: "Portfolio projects",
        value: projects.length,
        description: "Projects represented in the canonical dataset."
      }
    ];
  }

  /* Render the metric cards. */
  function render(container, profile, projects) {
    const metrics = createMetrics(profile, projects);

    container.innerHTML = `
      <div class="as-visualization-heading">
        <strong>Professional Impact Snapshot</strong>
        <span>Only documented values are displayed.</span>
      </div>
      <div class="as-impact-grid">
        ${metrics.map(function (metric) {
          return `
            <article class="as-impact-card">
              <span class="as-impact-label">
                ${escapeHtml(metric.label)}
              </span>
              <strong class="as-impact-value">
                ${escapeHtml(formatValue(metric.value))}
              </strong>
              <span class="as-impact-description">
                ${escapeHtml(metric.description)}
              </span>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  /* Initialize all impact dashboards. */
  async function init() {
    const containers = document.querySelectorAll(
      "[data-impact-dashboard], .impact-dashboard"
    );

    if (!containers.length) return;

    if (!window.ASilvaCredentialsService) {
      console.warn("[ASilvaImpactDashboard] Credentials service is required.");
      return;
    }

    try {
      const results = await Promise.all([
        window.ASilvaCredentialsService.getProfile(),
        window.ASilvaCredentialsService.getProjects()
      ]);

      containers.forEach(function (container) {
        render(container, results[0], results[1]);
      });
    } catch (error) {
      containers.forEach(function (container) {
        container.innerHTML =
          "<p>Impact metrics are temporarily unavailable.</p>";
      });
      console.error("[ASilvaImpactDashboard]", error);
    }
  }

  /* Publish the dashboard controller. */
  window.ASilvaImpactDashboard = { init };

  /* Start after the document is ready. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    void init();
  }
})();
