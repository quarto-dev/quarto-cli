(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], function () {
      return factory(root);
    });
  } else if (typeof exports === "object") {
    module.exports = factory(root);
  } else {
    root.Tabby = factory(root);
  }
})(
  typeof global !== "undefined"
    ? global
    : typeof window !== "undefined"
    ? window
    : this,
  function (window) {
    "use strict";

    //
    // Variables
    //

    var defaults = {
      idPrefix: "tabby-toggle_",
      default: "[data-tabby-default]",
    };

    //
    // Methods
    //

    /**
     * Merge two or more objects together.
     * @param   {Object}   objects  The objects to merge together
     * @returns {Object}            Merged values of defaults and options
     */
    var extend = function () {
      var merged = {};
      Array.prototype.forEach.call(arguments, function (obj) {
        for (var key in obj) {
          if (!obj.hasOwnProperty(key)) return;
          merged[key] = obj[key];
        }
      });
      return merged;
    };

    /**
     * Emit a custom event
     * @param  {String} type    The event type
     * @param  {Node}   tab     The tab to attach the event to
     * @param  {Node}   details Details about the event
     */
    var emitEvent = function (tab, details) {
      // Create a new event
      var event;
      if (typeof window.CustomEvent === "function") {
        event = new CustomEvent("tabby", {
          bubbles: true,
          cancelable: true,
          detail: details,
        });
      } else {
        event = document.createEvent("CustomEvent");
        event.initCustomEvent("tabby", true, true, details);
      }

      // Dispatch the event
      tab.dispatchEvent(event);
    };

    // In revealjs, arrow keys belong to slide navigation: tabs stay in the Tab
    // order and activate on focus. Elsewhere tabs use a roving tabindex with
    // arrow key navigation.
    var isReveal = function () {
      return window.document.body.classList.contains("reveal-viewport");
    };

    var focusHandler = function (event) {
      toggle(event.target);
    };

    var getKeyboardFocusableElements = function (element) {
      return [
        ...element.querySelectorAll(
          'a[href], button, input, textarea, select, summary,[tabindex]:not([tabindex="-1"])'
        ),
      ].filter(
        // Shown elements only, as the browser skips the others: hidden content,
        // like unselected panels (also of a nested tabset), is not rendered,
        // and revealjs fragments not yet shown have `visibility: hidden`
        (el) =>
          el.getAttribute("tabindex") !== "-1" &&
          !el.matches(":disabled") &&
          !el.getAttribute("aria-hidden") &&
          el.getClientRects().length > 0 &&
          window.getComputedStyle(el).visibility === "visible"
      );
    };

    // Tabs set up by tabby, as opposed to other tab widgets in a panel
    var tabbyTabs = new WeakSet();

    // The tab of a tab or of a tab panel
    var getTab = function (tabOrPanel) {
      return tabOrPanel.getAttribute("role") === "tab"
        ? tabOrPanel
        : document.getElementById(tabOrPanel.getAttribute("aria-labelledby"));
    };

    // Selects a tab and focuses the last focusable element of its panel, or
    // the tab itself if there is none. The panel content is hidden until the
    // tab is selected. When the panel ends with a nested tabset, its end is
    // the end of that tabset's last panel, as Tab would reach it.
    var focusEndOf = function (tab) {
      toggle(tab);
      var content = document.querySelector(tab.hash);
      var last = getKeyboardFocusableElements(content).pop();
      if (!last) return tab.focus();

      // Outermost tabby tab or tab panel between the last element and this
      // panel; other tab widgets are ordinary panel content
      var nestedTab;
      for (var node = last; node && node !== content; node = node.parentElement) {
        var role = node.getAttribute("role");
        var nodeTab =
          role === "tab" ? node : role === "tabpanel" ? getTab(node) : null;
        if (nodeTab && tabbyTabs.has(nodeTab)) nestedTab = nodeTab;
      }
      var nested = nestedTab && getTabsMap(nestedTab);
      if (nested) return focusEndOf(nested.tabs[nested.tabs.length - 1]);
      last.focus();
    };

    // In revealjs, Tab goes from a tab to its panel content and from the end
    // of that content to the next tab; Shift+Tab goes the other way. Tabs come
    // before all panels in the DOM, so the browser alone would go tab to tab.
    var tabOrderHandler = function (event) {
      // Leave Tab to controls that handle it themselves, like code editors
      if (event.key !== "Tab" || event.defaultPrevented) return;
      var current = event.currentTarget;
      var onTab = current.getAttribute("role") === "tab";
      var tab = getTab(current);
      var map = tab && getTabsMap(tab);
      if (!map) return;

      var target;
      if (onTab && !event.shiftKey) {
        target = getKeyboardFocusableElements(
          document.querySelector(tab.hash)
        )[0];
      } else if (onTab) {
        var previous = map.tabs[map.index - 1];
        if (!previous) return;
        event.preventDefault();
        focusEndOf(previous);
        return;
      } else {
        var focusables = getKeyboardFocusableElements(current);
        if (event.shiftKey && event.target === focusables[0]) {
          target = tab;
        } else if (
          !event.shiftKey &&
          event.target === focusables[focusables.length - 1]
        ) {
          target = map.tabs[map.index + 1];
        }
      }
      if (!target) return;

      event.preventDefault();
      target.focus();
    };

    // Whether Shift+Tab is being pressed. Focus moves while the key is down, so
    // this tells focus changes made by Shift+Tab apart from clicks.
    var shiftTabDown = false;
    var trackShiftTab = function () {
      if (trackShiftTab.done) return;
      trackShiftTab.done = true;
      document.addEventListener(
        "keydown",
        function (event) {
          shiftTabDown = event.key === "Tab" && event.shiftKey;
        },
        true
      );
      // A click, or leaving the window (the keyup then goes elsewhere), ends it
      // too
      var clear = function () {
        shiftTabDown = false;
      };
      document.addEventListener("keyup", clear, true);
      document.addEventListener("pointerdown", clear, true);
      window.addEventListener("blur", clear);
    };

    // In revealjs, Shift+Tab from after a tabset reaches the content of the
    // selected panel first, which skips the tabs after it. Start from the end
    // of the last panel instead, so Shift+Tab is the reverse of Tab. Only for
    // Shift+Tab: a click in a panel must keep that panel.
    var backwardEntryHandler = function (event) {
      var from = event.relatedTarget;
      var tab = getTab(event.currentTarget);
      var map = tab && getTabsMap(tab);
      if (!from || !map || !shiftTabDown) return;

      var tabList = map.tabs[0].closest('[role="tablist"]');
      var fromInside = Array.prototype.some.call(map.tabs, function (tab) {
        var content = document.querySelector(tab.hash);
        return tab === from || (content && content.contains(from));
      });
      var fromAfter =
        from.compareDocumentPosition(tabList) &
        Node.DOCUMENT_POSITION_PRECEDING;
      var last = map.tabs[map.tabs.length - 1];
      var lastContent = document.querySelector(last.hash);
      if (
        fromInside ||
        !fromAfter ||
        !lastContent ||
        lastContent.contains(event.target)
      ) {
        return;
      }

      focusEndOf(last);
    };

    /**
     * Remove roles and attributes from a tab and its content
     * @param  {Node}   tab      The tab
     * @param  {Node}   content  The tab content
     * @param  {Object} settings User settings and options
     */
    var destroyTab = function (tab, content, settings) {
      // Remove the generated ID
      if (tab.id.slice(0, settings.idPrefix.length) === settings.idPrefix) {
        tab.id = "";
      }

      // remove event listener
      tab.removeEventListener("focus", focusHandler, true);
      tab.removeEventListener("keydown", tabOrderHandler);
      content.removeEventListener("keydown", tabOrderHandler);
      tab.removeEventListener("focusin", backwardEntryHandler);
      content.removeEventListener("focusin", backwardEntryHandler);

      // Remove roles
      tab.removeAttribute("role");
      tab.removeAttribute("aria-controls");
      tab.removeAttribute("aria-selected");
      tab.removeAttribute("tabindex");
      tab.closest("li").removeAttribute("role");
      content.removeAttribute("role");
      content.removeAttribute("aria-labelledby");
      content.removeAttribute("hidden");
    };

    /**
     * Add the required roles and attributes to a tab and its content
     * @param  {Node}   tab      The tab
     * @param  {Node}   content  The tab content
     * @param  {Object} settings User settings and options
     */
    var setupTab = function (tab, content, settings) {
      // Give tab an ID if it doesn't already have one
      if (!tab.id) {
        tab.id = settings.idPrefix + content.id;
      }

      // Add roles
      tab.setAttribute("role", "tab");
      tabbyTabs.add(tab);
      tab.setAttribute("aria-controls", content.id);
      tab.closest("li").setAttribute("role", "presentation");
      content.setAttribute("role", "tabpanel");
      content.setAttribute("aria-labelledby", tab.id);

      // Add selected state
      if (tab.matches(settings.default)) {
        tab.setAttribute("aria-selected", "true");
      } else {
        tab.setAttribute("aria-selected", "false");
        if (!isReveal()) tab.setAttribute("tabindex", "-1");
        content.setAttribute("hidden", "hidden");
      }

      // add focus and Tab order event listeners
      if (isReveal()) {
        tab.addEventListener("focus", focusHandler);
        tab.addEventListener("keydown", tabOrderHandler);
        content.addEventListener("keydown", tabOrderHandler);
        tab.addEventListener("focusin", backwardEntryHandler);
        content.addEventListener("focusin", backwardEntryHandler);
        trackShiftTab();
      }
    };

    /**
     * Hide a tab and its content
     * @param  {Node} newTab The new tab that's replacing it
     */
    var hide = function (newTab) {
      // Variables
      var tabGroup = newTab.closest('[role="tablist"]');
      if (!tabGroup) return {};
      var tab = tabGroup.querySelector('[role="tab"][aria-selected="true"]');
      if (!tab) return {};
      var content = document.querySelector(tab.hash);

      // Hide the tab
      tab.setAttribute("aria-selected", "false");
      if (!isReveal()) tab.setAttribute("tabindex", "-1");

      // Hide the content
      if (!content) return { previousTab: tab };
      content.setAttribute("hidden", "hidden");

      // Return the hidden tab and content
      return {
        previousTab: tab,
        previousContent: content,
      };
    };

    /**
     * Show a tab and its content
     * @param  {Node} tab      The tab
     * @param  {Node} content  The tab content
     */
    var show = function (tab, content) {
      tab.setAttribute("aria-selected", "true");
      if (!isReveal()) tab.setAttribute("tabindex", "0");
      content.removeAttribute("hidden");
      tab.focus();
    };

    /**
     * Toggle a new tab
     * @param  {Node} tab The tab to show
     */
    var toggle = function (tab) {
      // Make sure there's a tab to toggle and it's not already active
      if (!tab || tab.getAttribute("aria-selected") == "true") return;

      // Variables
      var content = document.querySelector(tab.hash);
      if (!content) return;

      // Hide active tab and content
      var details = hide(tab);

      // Show new tab and content
      show(tab, content);

      // Add event details
      details.tab = tab;
      details.content = content;

      // Emit a custom event
      emitEvent(tab, details);
    };

    /**
     * Get all of the tabs in a tablist
     * @param  {Node}   tab  A tab from the list
     * @return {Object}      The tabs and the index of the currently active one
     */
    var getTabsMap = function (tab) {
      var tabGroup = tab.closest('[role="tablist"]');
      var tabs = tabGroup ? tabGroup.querySelectorAll('[role="tab"]') : null;
      if (!tabs) return;
      return {
        tabs: tabs,
        index: Array.prototype.indexOf.call(tabs, tab),
      };
    };

    /**
     * Switch the active tab based on keyboard activity
     * @param  {Node} tab The currently active tab
     * @param  {Key}  key The key that was pressed
     */
    var switchTabs = function (tab, key) {
      // Get a map of tabs
      var map = getTabsMap(tab);
      if (!map) return;
      var length = map.tabs.length - 1;
      var index;

      // Go to previous tab
      if (["ArrowUp", "ArrowLeft", "Up", "Left"].indexOf(key) > -1) {
        index = map.index < 1 ? length : map.index - 1;
      }

      // Go to next tab
      else if (["ArrowDown", "ArrowRight", "Down", "Right"].indexOf(key) > -1) {
        index = map.index === length ? 0 : map.index + 1;
      }

      // Go to home
      else if (key === "Home") {
        index = 0;
      }

      // Go to end
      else if (key === "End") {
        index = length;
      }

      // Toggle the tab
      toggle(map.tabs[index]);
    };

    /**
     * Create the Constructor object
     */
    var Constructor = function (selector, options) {
      //
      // Variables
      //

      var publicAPIs = {};
      var settings, tabWrapper;

      //
      // Methods
      //

      publicAPIs.destroy = function () {
        // Get all tabs
        var tabs = tabWrapper.querySelectorAll("a");

        // Add roles to tabs
        Array.prototype.forEach.call(tabs, function (tab) {
          // Get the tab content
          var content = document.querySelector(tab.hash);
          if (!content) return;

          // Setup the tab
          destroyTab(tab, content, settings);
        });

        // Remove role from wrapper
        tabWrapper.removeAttribute("role");

        // Remove event listeners
        document.documentElement.removeEventListener(
          "click",
          clickHandler,
          true
        );
        tabWrapper.removeEventListener("keydown", keyHandler, true);

        // Reset variables
        settings = null;
        tabWrapper = null;
      };

      /**
       * Setup the DOM with the proper attributes
       */
      publicAPIs.setup = function () {
        // Variables
        tabWrapper = document.querySelector(selector);
        if (!tabWrapper) return;
        var tabs = tabWrapper.querySelectorAll("a");

        // Add role to wrapper
        tabWrapper.setAttribute("role", "tablist");

        // Add roles to tabs
        Array.prototype.forEach.call(tabs, function (tab) {
          tab.setAttribute("tabindex", "0");

          // Get the tab content
          var content = document.querySelector(tab.hash);
          if (!content) return;

          // Setup the tab
          setupTab(tab, content, settings);
        });
      };

      /**
       * Toggle a tab based on an ID
       * @param  {String|Node} id The tab to toggle
       */
      publicAPIs.toggle = function (id) {
        // Get the tab
        var tab = id;
        if (typeof id === "string") {
          tab = document.querySelector(
            selector + ' [role="tab"][href*="' + id + '"]'
          );
        }

        // Toggle the tab
        toggle(tab);
      };

      /**
       * Handle click events
       */
      var clickHandler = function (event) {
        // Only run on toggles
        var tab = event.target.closest(selector + ' [role="tab"]');
        if (!tab) return;

        // Prevent link behavior
        event.preventDefault();

        // Toggle the tab
        toggle(tab);
      };

      /**
       * Handle keydown events
       */
      var keyHandler = function (event) {
        // Only run if a tab is in focus
        var tab = document.activeElement;
        if (!tab.matches(selector + ' [role="tab"]')) return;

        // Only run for specific keys
        var keys = isReveal()
          ? ["Home", "End"]
          : [
              "ArrowUp",
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
              "Up",
              "Down",
              "Left",
              "Right",
              "Home",
              "End",
            ];
        if (keys.indexOf(event.key) < 0) return;

        // Keep the key from also scrolling the page or, in revealjs, from
        // changing slide
        event.preventDefault();
        event.stopPropagation();

        // Switch tabs
        switchTabs(tab, event.key);
      };

      /**
       * Initialize the instance
       */
      var init = function () {
        // Merge user options with defaults
        settings = extend(defaults, options || {});

        // Setup the DOM
        publicAPIs.setup();

        // Add event listeners
        document.documentElement.addEventListener("click", clickHandler, true);
        tabWrapper.addEventListener("keydown", keyHandler, true);
      };

      //
      // Initialize and return the Public APIs
      //

      init();
      return publicAPIs;
    };

    //
    // Return the Constructor
    //

    return Constructor;
  }
);
