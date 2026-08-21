/**
 * Alvin Silva Platform — Theme Core.
 * Provides light, dark, and system theme modes with persistent user preference.
 */
(function () {
  "use strict";

  /* Prevent duplicate initialization. */
  if (window.ASilvaTheme) return;

  /* Define the theme module state. */
  const ASilvaTheme = {
    storageKey: "asilva-theme",
    defaultTheme: "system",
    currentTheme: "system",
    initialized: false
  };

  /* Accept only supported theme values. */
  function normalizeTheme(themeName) {
    const supportedThemes = ["light", "dark", "system"];

    return supportedThemes.includes(themeName)
      ? themeName
      : ASilvaTheme.defaultTheme;
  }

  /* Determine the system's preferred color scheme. */
  function getSystemTheme() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  /* Resolve a user preference into the actual visual theme. */
  function resolveTheme(themeName) {
    return themeName === "system" ? getSystemTheme() : themeName;
  }

  /* Update the document with the selected theme. */
  function applyTheme(themeName, persist = true) {
    const normalizedTheme = normalizeTheme(themeName);
    const resolvedTheme = resolveTheme(normalizedTheme);

    ASilvaTheme.currentTheme = normalizedTheme;

    document.documentElement.dataset.theme = normalizedTheme;
    document.documentElement.dataset.colorScheme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;

    document.documentElement.classList.toggle(
      "theme-light",
      resolvedTheme === "light"
    );

    document.documentElement.classList.toggle(
      "theme-dark",
      resolvedTheme === "dark"
    );

    document.querySelectorAll("[data-theme-value]").forEach(function (
      element
    ) {
      const valueType = element.dataset.themeValue;

      if (valueType === "current") {
        element.textContent = normalizedTheme;
      }

      if (valueType === "resolved") {
        element.textContent = resolvedTheme;
      }
    });

    document.querySelectorAll("[data-theme-option]").forEach(function (
      element
    ) {
      const isActive =
        normalizeTheme(element.dataset.themeOption) === normalizedTheme;

      element.classList.toggle("is-active", isActive);
      element.setAttribute("aria-pressed", String(isActive));
    });

    if (persist) {
      try {
        localStorage.setItem(ASilvaTheme.storageKey, normalizedTheme);
      } catch (error) {
        /* Continue when persistent storage is unavailable. */
      }
    }

    document.dispatchEvent(
      new CustomEvent("asilva:theme-change", {
        detail: {
          theme: normalizedTheme,
          resolvedTheme
        }
      })
    );
  }

  /* Read the user's persisted theme preference. */
  function getStoredTheme() {
    try {
      return localStorage.getItem(ASilvaTheme.storageKey) || "";
    } catch (error) {
      return "";
    }
  }

  /* Initialize theme selector controls. */
  function initializeControls() {
    document.addEventListener("click", function (clickEvent) {
      const themeControl = clickEvent.target.closest("[data-theme-option]");

      if (!themeControl) return;

      clickEvent.preventDefault();
      applyTheme(themeControl.dataset.themeOption);
    });

    document.addEventListener("change", function (changeEvent) {
      const themeSelector = changeEvent.target.closest(
        "[data-theme-selector]"
      );

      if (!themeSelector) return;

      applyTheme(themeSelector.value);
    });
  }

  /* Keep system mode synchronized with operating-system theme changes. */
  function initializeSystemThemeListener() {
    if (!window.matchMedia) return;

    const systemThemeQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const handleSystemThemeChange = function () {
      if (ASilvaTheme.currentTheme === "system") {
        applyTheme("system", false);
      }
    };

    if (systemThemeQuery.addEventListener) {
      systemThemeQuery.addEventListener("change", handleSystemThemeChange);
    } else if (systemThemeQuery.addListener) {
      systemThemeQuery.addListener(handleSystemThemeChange);
    }
  }

  /* Expose the theme controls to the rest of the site. */
  ASilvaTheme.get = function () {
    return ASilvaTheme.currentTheme;
  };

  ASilvaTheme.getResolved = function () {
    return resolveTheme(ASilvaTheme.currentTheme);
  };

  ASilvaTheme.set = function (themeName) {
    applyTheme(themeName);
  };

  ASilvaTheme.toggle = function () {
    const resolvedTheme = resolveTheme(ASilvaTheme.currentTheme);

    applyTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  /* Initialize the theme system before or immediately after page rendering. */
  ASilvaTheme.init = function () {
    if (ASilvaTheme.initialized) return;

    const storedTheme = getStoredTheme();

    ASilvaTheme.currentTheme = normalizeTheme(
      storedTheme || document.documentElement.dataset.theme || "system"
    );

    applyTheme(ASilvaTheme.currentTheme, false);
    initializeControls();
    initializeSystemThemeListener();

    ASilvaTheme.initialized = true;
  };

  /* Publish the theme module globally. */
  window.ASilvaTheme = ASilvaTheme;

  /* Initialize as early as possible. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ASilvaTheme.init, {
      once: true
    });
  } else {
    ASilvaTheme.init();
  }
})();
