/**
 * @module RevealJsTabset
 * @version 1.2.0
 * @license MIT
 * @copyright 2026 Mickaël Canouil
 * @author Mickaël Canouil
 */

window.RevealJsTabset = function () {
  return {
    id: "RevealJsTabset",
    init: function (deck) {
      const TAB_SELECTOR = "ul.panel-tabset-tabby > li";
      const TAB_LINK_SELECTOR = "ul.panel-tabset-tabby > li a";

      /**
       * Get all tab panes for a given tabset element.
       * @param {Element} tabset - The tabset container element
       * @returns {HTMLCollection} Collection of tab pane elements
       */
      function getTabPanes(tabset) {
        const tabContent = tabset.querySelector(".tab-content");
        return tabContent ? tabContent.children : [];
      }

      /**
       * Initialise tabset fragments on ready.
       * This sets up fragment indices for tab content and creates invisible
       * fragment triggers for tab navigation.
       */
      deck.on("ready", function () {
        const tabsetSlides = document.querySelectorAll(
          ".reveal .slides section .panel-tabset",
        );

        tabsetSlides.forEach(function (tabset) {
          const tabs = tabset.querySelectorAll(TAB_SELECTOR);
          const tabCount = tabs.length;
          if (tabCount <= 1) return;

          const tabPanes = getTabPanes(tabset);
          const parentNode = tabset.parentNode;
          let currentIndex = 0;

          // Process each tab
          for (let i = 0; i < tabCount; i++) {
            if (tabPanes[i]) {
              // Assign fragment indices to any fragments within the tab pane
              const fragmentsInPane = tabPanes[i].querySelectorAll(".fragment");
              fragmentsInPane.forEach(function (fragment) {
                fragment.setAttribute("data-fragment-index", currentIndex);
                currentIndex++;
              });
            }

            // Create invisible fragment triggers for tab switching (except after last tab)
            if (i < tabCount - 1) {
              const fragmentDiv = document.createElement("div");
              fragmentDiv.className = "panel-tabset-fragment fragment";
              fragmentDiv.dataset.tabIndex = i + 1;
              fragmentDiv.setAttribute("data-fragment-index", currentIndex);
              fragmentDiv.style.display = "none";
              fragmentDiv.setAttribute("aria-hidden", "true");
              parentNode.appendChild(fragmentDiv);
              currentIndex++;
            }
          }
        });
      });

      /**
       * Handle fragment shown events.
       * When a tabset fragment is shown, click the corresponding tab.
       */
      deck.on("fragmentshown", function (event) {
        if (!event.fragment.classList.contains("panel-tabset-fragment")) return;

        const tabIndex = parseInt(event.fragment.dataset.tabIndex, 10);
        if (isNaN(tabIndex)) return;
        const tabset = deck.getCurrentSlide().querySelector(".panel-tabset");
        if (!tabset) return;

        const tabLinks = tabset.querySelectorAll(TAB_LINK_SELECTOR);
        if (tabLinks[tabIndex]) {
          tabLinks[tabIndex].click();
        }
      });

      /**
       * Handle fragment hidden events.
       * When a tabset fragment is hidden (going backwards), click the previous tab.
       */
      deck.on("fragmenthidden", function (event) {
        if (!event.fragment.classList.contains("panel-tabset-fragment")) return;

        const tabIndex = parseInt(event.fragment.dataset.tabIndex, 10);
        if (isNaN(tabIndex)) return;
        const tabset = deck.getCurrentSlide().querySelector(".panel-tabset");
        if (!tabset) return;

        const tabLinks = tabset.querySelectorAll(TAB_LINK_SELECTOR);
        const targetIndex = tabIndex > 0 ? tabIndex - 1 : 0;
        if (tabLinks[targetIndex]) {
          tabLinks[targetIndex].click();
        }
      });

      /**
       * Handle PDF export mode.
       * Ensures the correct tab is visible based on fragment state.
       */
      deck.on("pdf-ready", function () {
        const slides = document.querySelectorAll(".reveal .slides section");

        slides.forEach(function (slide) {
          const tabset = slide.querySelector(".panel-tabset");
          if (!tabset) return;

          const fragments = slide.querySelectorAll(".panel-tabset-fragment");
          let activeTabIndex = 0;

          // Find the highest visible tab index
          fragments.forEach(function (fragment) {
            if (fragment.classList.contains("visible")) {
              const tabIndex = parseInt(fragment.dataset.tabIndex, 10);
              if (!isNaN(tabIndex) && tabIndex > activeTabIndex) {
                activeTabIndex = tabIndex;
              }
            }
          });

          // Update tab states
          const tabLinks = tabset.querySelectorAll(TAB_LINK_SELECTOR);
          const tabPanes = getTabPanes(tabset);
          const tabPanesArray = Array.from(tabPanes);

          tabLinks.forEach(function (link, index) {
            const li = link.parentElement;
            const isActive = index === activeTabIndex;

            li.classList.toggle("active", isActive);
            link.setAttribute("aria-selected", isActive ? "true" : "false");
            link.setAttribute("tabindex", isActive ? "0" : "-1");
          });

          // Update pane visibility
          tabPanesArray.forEach(function (panel, index) {
            const isActive = index === activeTabIndex;

            panel.classList.toggle("active", isActive);
            panel.style.display = isActive ? "block" : "none";
            if (isActive) {
              panel.removeAttribute("hidden");
            } else {
              panel.setAttribute("hidden", "");
            }
          });
        });
      });
    },
  };
};
