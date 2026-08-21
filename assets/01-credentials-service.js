/* Alvin Silva Platform: canonical professional credentials service. */
(function () {
  "use strict";

  /* Avoid registering the service more than once. */
  if (window.ASilvaCredentialsService) return;

  /* Keep the service configuration isolated from application code. */
  const configuration = {
    sourcePath: "credentials.json",
    cacheKey: "asilva-credentials-cache-v1"
  };

  /* Store the loaded credentials in memory for this page session. */
  let credentialsCache = null;

  /* Safely read a non-sensitive cached credentials dataset. */
  function readLocalCache() {
    try {
      const storedValue = localStorage.getItem(configuration.cacheKey);
      return storedValue ? JSON.parse(storedValue) : null;
    } catch (error) {
      return null;
    }
  }

  /* Safely write the non-sensitive credentials dataset to browser storage. */
  function writeLocalCache(credentials) {
    try {
      localStorage.setItem(
        configuration.cacheKey,
        JSON.stringify({
          version: 1,
          storedAt: new Date().toISOString(),
          credentials
        })
      );
    } catch (error) {
      /* Local caching is optional and never blocks the platform. */
    }
  }

  /* Normalize the minimum expected credentials structure. */
  function normalizeCredentials(credentials) {
    if (!credentials || typeof credentials !== "object") {
      throw new Error("credentials.json must contain a JSON object.");
    }

    if (!credentials.profile || typeof credentials.profile !== "object") {
      credentials.profile = {};
    }

    ["institutions", "disciplines", "projects", "publications"].forEach(
      function (collectionName) {
        if (!Array.isArray(credentials[collectionName])) {
          credentials[collectionName] = [];
        }
      }
    );

    return credentials;
  }

  /* Load the canonical credentials file, using cache only as a fallback. */
  async function load(forceRefresh) {
    if (credentialsCache && !forceRefresh) return credentialsCache;

    try {
      const response = await fetch(configuration.sourcePath, {
        cache: forceRefresh ? "no-store" : "default",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(
          "Unable to load credentials.json: HTTP " + response.status
        );
      }

      credentialsCache = normalizeCredentials(await response.json());
      writeLocalCache(credentialsCache);

      document.dispatchEvent(
        new CustomEvent("asilva:credentials-loaded", {
          detail: { source: configuration.sourcePath }
        })
      );

      return credentialsCache;
    } catch (error) {
      const cachedPackage = readLocalCache();

      if (cachedPackage && cachedPackage.credentials) {
        credentialsCache = normalizeCredentials(cachedPackage.credentials);
        return credentialsCache;
      }

      throw error;
    }
  }

  /* Return Alvin Silva's professional profile. */
  async function getProfile() {
    return (await load()).profile;
  }

  /* Return documented projects. */
  async function getProjects() {
    return (await load()).projects;
  }

  /* Return documented institutions. */
  async function getInstitutions() {
    return (await load()).institutions;
  }

  /* Return documented professional disciplines. */
  async function getDisciplines() {
    return (await load()).disciplines;
  }

  /* Return documented publications. */
  async function getPublications() {
    return (await load()).publications;
  }

  /* Search projects without sending credentials to an external service. */
  async function searchProjects(searchTerm) {
    const normalizedSearchTerm = String(searchTerm || "").trim().toLowerCase();
    const projects = await getProjects();

    if (!normalizedSearchTerm) return projects;

    return projects.filter(function (project) {
      return JSON.stringify(project)
        .toLowerCase()
        .includes(normalizedSearchTerm);
    });
  }

  /* Clear the in-memory and browser cache. */
  function clearCache() {
    credentialsCache = null;

    try {
      localStorage.removeItem(configuration.cacheKey);
    } catch (error) {
      /* Storage is optional. */
    }
  }

  /* Publish the service API. */
  window.ASilvaCredentialsService = {
    load,
    getProfile,
    getProjects,
    getInstitutions,
    getDisciplines,
    getPublications,
    searchProjects,
    clearCache
  };
})();