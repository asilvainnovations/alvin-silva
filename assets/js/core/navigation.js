/**
 * Alvin Silva Platform — Navigation Core.
 * Provides resilient desktop and mobile navigation, active-section tracking,
 * keyboard support, outside-click handling, and responsive navigation state.
 */
(function () {
  "use strict";

  /* Prevent duplicate initialization. */
  if (window.ASilvaNavigation) return;

  /* Define the navigation module state. */
  const ASilvaNavigation = {
    initialized: false,
    mobileMenuOpen: false
  };

  /* Locate the site's navigation elements using several compatible selectors. */
  function getNavigationElements() {
    return {
      navigation:
        document.querySelector("[data-site-navigation]") ||
        document.querySelector("nav"),
      menuButton:
        document.querySelector("[data-menu-toggle]") ||
        document.querySelector(".menu-toggle") ||
        document.querySelector(".hamburger") ||
        document.querySelector('[aria-controls*="menu"]'),
      menuPanel:
        document.querySelector("[data-menu-panel]") ||
        document.querySelector(".mobile-menu") ||
        document.querySelector(".nav-menu") ||
        document.querySelector(".navbar-menu")
    };
  }

  /* Determine whether the current URL belongs to the same page. */
  function isSamePageLink(linkElement) {
    if (!linkElement || !linkElement.href) return false;

    const linkUrl = new URL(linkElement.href, window.location.href);

    return (
      linkUrl.origin === window.location.origin &&
      linkUrl.pathname.replace(/\/$/, "") ===
        window.location.pathname.replace(/\/$/, "") &&
      Boolean(linkUrl.hash)
    );
  }

  /* Open the mobile navigation menu. */
  function openMobileMenu(elements) {
    if (!elements.menuPanel || !elements.menuButton) return;

    ASilvaNavigation.mobileMenuOpen = true;
    elements.menuPanel.classList.add("is-open", "open", "active");
    elements.menuPanel.hidden = false;
    elements.menuButton.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("navigation-open");
    document.body.classList.add("navigation-open");
  }

  /* Close the mobile navigation menu. */
  function closeMobileMenu(elements) {
    if (!elements.menuPanel || !elements.menuButton) return;

    ASilvaNavigation.mobileMenuOpen = false;
    elements.menuPanel.classList.remove("is-open", "open", "active");
    elements.menuPanel.hidden = false;
    elements.menuButton.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("navigation-open");
    document.body.classList.remove("navigation-open");
  }

  /* Toggle the mobile navigation state. */
  function toggleMobileMenu(elements) {
    if (ASilvaNavigation.mobileMenuOpen) {
      closeMobileMenu(elements);
    } else {
      openMobileMenu(elements);
    }
  }

  /* Close navigation when a same-page navigation link is selected. */
  function initializeLinkHandling(elements) {
    document.addEventListener("click", function (clickEvent) {
      const linkElement = clickEvent.target.closest("a");

      if (!linkElement) return;

      if (isSamePageLink(linkElement)) {
        closeMobileMenu(elements);
      }
    });
  }

  /* Close the menu when the user clicks outside it. */
  function initializeOutsideClickHandling(elements) {
    document.addEventListener("click", function (clickEvent) {
      if (!ASilvaNavigation.mobileMenuOpen) return;
      if (!elements.menuPanel || !elements.menuButton) return;

      const clickedInsideMenu = elements.menuPanel.contains(clickEvent.target);
      const clickedMenuButton = elements.menuButton.contains(clickEvent.target);

      if (!clickedInsideMenu && !clickedMenuButton) {
        closeMobileMenu(elements);
      }
    });
  }

  /* Support Escape as the standard keyboard close command. */
  function initializeKeyboardHandling(elements) {
    document.addEventListener("keydown", function (keyboardEvent) {
      if (keyboardEvent.key === "Escape" && ASilvaNavigation.mobileMenuOpen) {
        closeMobileMenu(elements);
        elements.menuButton?.focus();
      }
    });
  }

  /* Keep navigation state synchronized with viewport size. */
  function initializeResponsiveHandling(elements) {
    const mobileBreakpointQuery = window.matchMedia
      ? window.matchMedia("(min-width: 900px)")
      : null;

    if (!mobileBreakpointQuery) return;

    const handleBreakpointChange = function (event) {
      if (event.matches) {
        closeMobileMenu(elements);
      }
    };

    if (mobileBreakpointQuery.addEventListener) {
      mobileBreakpointQuery.addEventListener("change", handleBreakpointChange);
    } else if (mobileBreakpointQuery.addListener) {
      mobileBreakpointQuery.addListener(handleBreakpointChange);
    }
  }

  /* Mark the navigation link corresponding to the current section. */
  function initializeActiveSectionTracking(elements) {
    if (!elements.navigation) return;

    const sectionLinks = Array.from(
      elements.navigation.querySelectorAll('a[href*="#"]')
    ).filter(function (linkElement) {
      return isSamePageLink(linkElement);
    });

    if (!sectionLinks.length || !("IntersectionObserver" in window)) return;

    const sections = sectionLinks
      .map(function (linkElement) {
        const hash = new URL(linkElement.href).hash;

        try {
          return document.querySelector(hash);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);

    if (!sections.length) return;

    const sectionToLinks = new Map();

    sectionLinks.forEach(function (linkElement) {
      const hash = new URL(linkElement.href).hash;
      const sectionElement = document.querySelector(hash);

      if (!sectionElement) return;

      if (!sectionToLinks.has(sectionElement)) {
        sectionToLinks.set(sectionElement, []);
      }

      sectionToLinks.get(sectionElement).push(linkElement);
    });

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          const matchingLinks = sectionToLinks.get(entry.target);

          if (!matchingLinks) return;

          matchingLinks.forEach(function (linkElement) {
            linkElement.classList.toggle("is-active", entry.isIntersecting);

            if (entry.isIntersecting) {
              linkElement.setAttribute("aria-current", "page");
            } else {
              linkElement.removeAttribute("aria-current");
            }
          });
        });
      },
      {
        rootMargin: "-25% 0px -60% 0px",
        threshold: 0
      }
    );

    sections.forEach(function (sectionElement) {
      observer.observe(sectionElement);
    });
  }

  /* Initialize the navigation module. */
  ASilvaNavigation.init = function () {
    if (ASilvaNavigation.initialized) return;

    const elements = getNavigationElements();

    if (!elements.navigation && !elements.menuButton && !elements.menuPanel) {
      ASilvaNavigation.initialized = true;
      return;
    }

    if (elements.menuButton) {
      elements.menuButton.setAttribute(
        "aria-expanded",
        elements.menuButton.getAttribute("aria-expanded") || "false"
      );

      elements.menuButton.addEventListener("click", function (clickEvent) {
        clickEvent.preventDefault();
        toggleMobileMenu(elements);
      });
    }

    initializeLinkHandling(elements);
    initializeOutsideClickHandling(elements);
    initializeKeyboardHandling(elements);
    initializeResponsiveHandling(elements);
    initializeActiveSectionTracking(elements);

    ASilvaNavigation.initialized = true;
  };

  /* Expose explicit menu methods for other modules. */
  ASilvaNavigation.open = function () {
    openMobileMenu(getNavigationElements());
  };

  ASilvaNavigation.close = function () {
    closeMobileMenu(getNavigationElements());
  };

  ASilvaNavigation.toggle = function () {
    toggleMobileMenu(getNavigationElements());
  };

  /* Publish the navigation module. */
  window.ASilvaNavigation = ASilvaNavigation;

  /* Initialize when the document becomes available. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ASilvaNavigation.init, {
      once: true
    });
  } else {
    ASilvaNavigation.init();
  }
})();
