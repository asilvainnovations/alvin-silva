/* Alvin Silva Platform: documented expertise landscape visualization. */
(function () {
  "use strict";

  /* Avoid duplicate initialization. */
  if (window.ASilvaExpertiseRadar) return;

  /* Escape labels before placing them inside SVG. */
  function escapeXml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /* Normalize discipline records from multiple compatible schemas. */
  function normalizeDisciplines(disciplines) {
    return disciplines
      .map(function (discipline) {
        if (typeof discipline === "string") return discipline;

        return (
          discipline.name ||
          discipline.title ||
          discipline.discipline ||
          discipline.label ||
          ""
        );
      })
      .map(function (discipline) {
        return String(discipline).trim();
      })
      .filter(Boolean)
      .filter(function (discipline, index, collection) {
        return collection.indexOf(discipline) === index;
      })
      .slice(0, 10);
  }

  /* Render the evidence-presence radar. */
  function render(container, disciplines) {
    const labels = normalizeDisciplines(disciplines);

    if (!labels.length) {
      container.innerHTML =
        "<p>No documented disciplines are available.</p>";
      return;
    }

    const width = 760;
    const height = 620;
    const centerX = 380;
    const centerY = 310;
    const radius = 210;
    const axisCount = labels.length;

    function pointFor(index, distance) {
      const angle =
        -Math.PI / 2 +
        (index / axisCount) * Math.PI * 2;

      return {
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance
      };
    }

    const rings = [0.25, 0.5, 0.75, 1].map(function (scale) {
      const points = labels.map(function (_, index) {
        const point = pointFor(index, radius * scale);
        return point.x + "," + point.y;
      }).join(" ");

      return `
        <polygon points="${points}" fill="none"
                 stroke="currentColor" stroke-opacity=".12"/>
      `;
    }).join("");

    const axes = labels.map(function (_, index) {
      const point = pointFor(index, radius);

      return `
        <line x1="${centerX}" y1="${centerY}"
              x2="${point.x}" y2="${point.y}"
              stroke="currentColor" stroke-opacity=".15"/>
      `;
    }).join("");

    const evidencePoints = labels.map(function (_, index) {
      const point = pointFor(index, radius * 0.78);
      return point.x + "," + point.y;
    }).join(" ");

    const textLabels = labels.map(function (label, index) {
      const point = pointFor(index, radius + 48);
      const anchor =
        point.x < centerX - 12
          ? "end"
          : point.x > centerX + 12
          ? "start"
          : "middle";

      return `
        <text x="${point.x}" y="${point.y}"
              text-anchor="${anchor}"
              dominant-baseline="middle"
              font-family="Roboto Condensed, sans-serif"
              font-size="16">
          ${escapeXml(label)}
        </text>
      `;
    }).join("");

    container.innerHTML = `
      <div class="as-visualization-heading">
        <strong>Strategic Expertise Landscape</strong>
        <span>
          Documented disciplines shown as evidence presence, not subjective proficiency scores.
        </span>
      </div>
      <div class="as-expertise-radar">
        <svg viewBox="0 0 ${width} ${height}" role="img"
             aria-labelledby="expertise-title expertise-description">
          <title id="expertise-title">Alvin Silva expertise landscape</title>
          <desc id="expertise-description">
            Documented professional disciplines represented in a radar-style visualization.
          </desc>
          ${rings}
          ${axes}
          <polygon points="${evidencePoints}"
                   fill="currentColor" fill-opacity=".12"
                   stroke="currentColor" stroke-width="2"/>
          ${textLabels}
        </svg>
      </div>
    `;
  }

  /* Initialize every expertise radar placeholder. */
  async function init() {
    const containers = document.querySelectorAll(
      "[data-expertise-radar], .expertise-radar"
    );

    if (!containers.length) return;

    if (!window.ASilvaCredentialsService) {
      console.warn("[ASilvaExpertiseRadar] Credentials service is required.");
      return;
    }

    try {
      const disciplines =
        await window.ASilvaCredentialsService.getDisciplines();

      containers.forEach(function (container) {
        render(container, disciplines);
      });
    } catch (error) {
      containers.forEach(function (container) {
        container.innerHTML =
          "<p>Expertise visualization is temporarily unavailable.</p>";
      });
      console.error("[ASilvaExpertiseRadar]", error);
    }
  }

  /* Publish the visualization controller. */
  window.ASilvaExpertiseRadar = { init };

  /* Start after the document is ready. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    void init();
  }
})();
