/**
 * MIT License
 *
 * Copyright (c) 2025 Mickaël Canouil
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Author: Mickaël Canouil
 * Version: 1.0.0
 * License: MIT
 * Source: https://github.com/mcanouil/quarto-revealjs-tabset
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
        const tabsetSlides = document.querySelectorAll(".reveal .slides section .panel-tabset");

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
              if (tabIndex > activeTabIndex) {
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
          });
        });
      });
    },
  };
};
