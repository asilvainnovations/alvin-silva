/* Alvin Silva Platform — credentials service (compatibility shim).
 *
 * CONSOLIDATED 2026-11-02 (CIOMS D1). This file used to be a second,
 * independent loader for credentials.json with its own localStorage cache
 * ("asilva-credentials-cache-v1"). Two services both claiming to be the
 * canonical source recreated the forked-data problem one layer down.
 *
 * It is now a thin facade over ASilva.data (assets/js/core/data.js), which is
 * the only module that fetches credentials.json. The public API is kept so
 * any external consumer of window.ASilvaCredentialsService keeps working.
 * No page loads this file today; boot.js does not need it.
 */
(function () {
  "use strict";

  if (window.ASilvaCredentialsService) return;

  /* Purge the old duplicate cache once — it could hold a stale profile. */
  try { localStorage.removeItem("asilva-credentials-cache-v1"); } catch (_) { /* optional */ }

  function core() {
    if (!window.ASilva || !window.ASilva.data) {
      throw new Error("ASilva.data is not loaded. Load assets/js/boot.js before using ASilvaCredentialsService.");
    }
    return window.ASilva.data;
  }

  async function load(forceRefresh) {
    const data = core();
    return forceRefresh && data.reload ? data.reload() : data.load();
  }

  async function searchProjects(searchTerm) {
    const term = String(searchTerm || "").trim().toLowerCase();
    const projects = (await load()).projects;
    if (!term) return projects;
    return projects.filter((p) => JSON.stringify(p).toLowerCase().includes(term));
  }

  window.ASilvaCredentialsService = {
    load,
    getProfile: async () => (await load()).profile,
    getProjects: async () => (await load()).projects,
    getInstitutions: async () => (await load()).institutions,
    getDisciplines: async () => (await load()).disciplines,
    getPublications: async () => (await load()).publications,
    getCertifications: async () => (await load()).certifications,
    searchProjects,
    clearCache: () => { const d = core(); return d.reload ? d.reload() : null; }
  };
})();
