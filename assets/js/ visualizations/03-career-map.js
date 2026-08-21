/* Alvin Silva Platform: accessible professional career timeline. */
(function () {
  "use strict";

  /* Avoid duplicate initialization. */
  if (window.ASilvaCareerMap) return;

  /* Escape values before placing them inside SVG markup. */
  function escapeXml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /* Extract the first credible four-digit year from a project. */
  function extractYear(project) {
    const source = String(
      project.year ||
      project.date ||
      project.start_year ||
      project.startYear ||
      ""
    );

    const match = source.match(/\b(?:19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
  }

  /* Convert project records into visualization records. */
  function normalizeProjects(projects) {
    return projects
      .map(function (project) {
        return {
          year: extractYear(project),
          title:
            project.name ||
            project.title ||
            project.project_name ||
            "Professional engagement",
          organization:
            project.organization ||
            project.client ||
            project.institution ||
            "",
          description:
            project.description ||
            project.summary ||
            ""
        };
      })
      .filter(function (project) {
        return Number.isFinite(project.year);
      })
      .sort(function (a, b) {
        return a.year - b.year;
      });
  }

  /* Render one timeline container. */
  function render(container, projects) {
    const records = normalizeProjects(projects);

    if (!records.length) {
      container.innerHTML =
        "<p>No dated professional engagements are available.</p>";
      return;
    }

    const width = 1200;
    const padding = 70;
    const rowHeight = 120;
    const height = Math.max(300, padding * 2 + records.length * rowHeight);
    const firstYear = records[0].year;
    const lastYear = records[records.length - 1].year;
    const yearRange = Math.max(1, lastYear - firstYear);

    function xFor(year) {
      return padding +
        ((year - firstYear) / yearRange) *
        (width - padding * 2);
    }

    const events = records.map(function (record, index) {
      const x = xFor(record.year);
      const y = padding + index * rowHeight + 35;
      const title = escapeXml(record.title);
      const organization = escapeXml(record.organization);
      const description = escapeXml(record.description).slice(0, 180);

      return `
        <g class="as-career-event" tabindex="0" role="article"
           aria-label="${title}, ${record.year}">
          <line x1="${x}" y1="${padding}" x2="${x}" y2="${y - 12}"
                stroke="currentColor" stroke-opacity=".2" stroke-width="2"/>
          <circle cx="${x}" cy="${y}" r="9"
                  fill="currentColor" stroke="white" stroke-width="3"/>
          <text x="${x + 18}" y="${y - 2}"
                font-family="Montserrat, sans-serif"
                font-size="20" font-weight="700">${title}</text>
          <text x="${x + 18}" y="${y + 22}"
                font-family="Roboto Condensed, sans-serif"
                font-size="15" opacity=".72">
            ${record.year}${organization ? " · " + organization : ""}
          </text>
          ${description ? `
            <text x="${x + 18}" y="${y + 46}"
                  font-family="Roboto Condensed, sans-serif"
                  font-size="13" opacity=".62">${description}</text>
          ` : ""}
        </g>
      `;
    }).join("");

    container.innerHTML = `
      <div class="as-visualization-heading">
        <strong>Professional Career Timeline</strong>
        <span>Documented engagements with usable dates.</span>
      </div>
      <div class="as-career-map-scroll" tabindex="0"
           aria-label="Scrollable professional career timeline">
        <svg viewBox="0 0 ${width} ${height}" role="img"
             aria-labelledby="career-map-title career-map-description">
          <title id="career-map-title">Alvin Silva career timeline</title>
          <desc id="career-map-description">
            A timeline generated from documented professional engagements.
          </desc>
          <line x1="${padding}" y1="${padding}"
                x2="${width - padding}" y2="${padding}"
                stroke="currentColor" stroke-opacity=".25" stroke-width="3"/>
          ${events}
        </svg>
      </div>
    `;
  }

  /* Initialize every career-map placeholder on the page. */
  async function init() {
    const containers = document.querySelectorAll(
      "[data-career-map], .career-map"
    );

    if (!containers.length) return;

    if (!window.ASilvaCredentialsService) {
      console.warn("[ASilvaCareerMap] Credentials service is required.");
      return;
    }

    try {
      const projects =
        await window.ASilvaCredentialsService.getProjects();

      containers.forEach(function (container) {
        render(container, projects);
      });
    } catch (error) {
      containers.forEach(function (container) {
        container.innerHTML =
          "<p>Career visualization is temporarily unavailable.</p>";
      });
      console.error("[ASilvaCareerMap]", error);
    }
  }

  /* Publish the visualization controller. */
  window.ASilvaCareerMap = { init };

  /* Start after the document is ready. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    void init();
  }
})();
