/*! bslib 0.5.1 | (c) 2012-2023 RStudio, PBC. | License: MIT + file LICENSE */
"use strict";
(() => {
  // srcts/src/components/_utils.ts
  var InputBinding = window.Shiny ? Shiny.InputBinding : class {
  };
  function getAllFocusableChildren(el) {
    const base = [
      "a[href]",
      "area[href]",
      "button",
      "details summary",
      "input",
      "iframe",
      "select",
      "textarea",
      '[contentEditable=""]',
      '[contentEditable="true"]',
      '[contentEditable="TRUE"]',
      "[tabindex]"
    ];
    const modifiers = [':not([tabindex="-1"])', ":not([disabled])"];
    const selectors = base.map((b) => b + modifiers.join(""));
    const focusable = el.querySelectorAll(selectors.join(", "));
    return Array.from(focusable);
  }

  // srcts/src/components/_shinyResizeObserver.ts
  var ShinyResizeObserver = class {
    /**
     * Watch containers for size changes and ensure that Shiny outputs and
     * htmlwidgets within resize appropriately.
     *
     * @details
     * The ShinyResizeObserver is used to watch the containers, such as Sidebars
     * and Cards for size changes, in particular when the sidebar state is toggled
     * or the card body is expanded full screen. It performs two primary tasks:
     *
     * 1. Dispatches a `resize` event on the window object. This is necessary to
     *    ensure that Shiny outputs resize appropriately. In general, the window
     *    resizing is throttled and the output update occurs when the transition
     *    is complete.
     * 2. If an output with a resize method on the output binding is detected, we
     *    directly call the `.onResize()` method of the binding. This ensures that
     *    htmlwidgets transition smoothly. In static mode, htmlwidgets does this
     *    already.
     *
     * @note
     * This resize observer also handles race conditions in some complex
     * fill-based layouts with multiple outputs (e.g., plotly), where shiny
     * initializes with the correct sizing, but in-between the 1st and last
     * renderValue(), the size of the output containers can change, meaning every
     * output but the 1st gets initialized with the wrong size during their
     * renderValue(). Then, after the render phase, shiny won't know to trigger a
     * resize since all the widgets will return to their original size (and thus,
     * Shiny thinks there isn't any resizing to do). The resize observer works
     * around this by ensuring that the output is resized whenever its container
     * size changes.
     * @constructor
     */
    constructor() {
      this.resizeObserverEntries = [];
      this.resizeObserver = new ResizeObserver((entries) => {
        const resizeEvent = new Event("resize");
        window.dispatchEvent(resizeEvent);
        if (!window.Shiny)
          return;
        const resized = [];
        for (const entry of entries) {
          if (!(entry.target instanceof HTMLElement))
            continue;
          if (!entry.target.querySelector(".shiny-bound-output"))
            continue;
          entry.target.querySelectorAll(".shiny-bound-output").forEach((el) => {
            if (resized.includes(el))
              return;
            const { binding, onResize } = $(el).data("shinyOutputBinding");
            if (!binding || !binding.resize)
              return;
            const owner = el.shinyResizeObserver;
            if (owner && owner !== this)
              return;
            if (!owner)
              el.shinyResizeObserver = this;
            onResize(el);
            resized.push(el);
            if (!el.classList.contains("shiny-plot-output"))
              return;
            const img = el.querySelector(
              'img:not([width="100%"])'
            );
            if (img)
              img.setAttribute("width", "100%");
          });
        }
      });
    }
    /**
     * Observe an element for size changes.
     * @param {HTMLElement} el - The element to observe.
     */
    observe(el) {
      this.resizeObserver.observe(el);
      this.resizeObserverEntries.push(el);
    }
    /**
     * Stop observing an element for size changes.
     * @param {HTMLElement} el - The element to stop observing.
     */
    unobserve(el) {
      const idxEl = this.resizeObserverEntries.indexOf(el);
      if (idxEl < 0)
        return;
      this.resizeObserver.unobserve(el);
      this.resizeObserverEntries.splice(idxEl, 1);
    }
    /**
     * This method checks that we're not continuing to watch elements that no
     * longer exist in the DOM. If any are found, we stop observing them and
     * remove them from our array of observed elements.
     *
     * @private
     * @static
     */
    flush() {
      this.resizeObserverEntries.forEach((el) => {
        if (!document.body.contains(el))
          this.unobserve(el);
      });
    }
  };

  // srcts/src/components/card.ts
  var _Card = class {
    /**
     * Creates an instance of a bslib Card component.
     *
     * @constructor
     * @param {HTMLElement} card
     */
    constructor(card) {
      var _a;
      card.removeAttribute(_Card.attr.ATTR_INIT);
      (_a = card.querySelector(`script[${_Card.attr.ATTR_INIT}]`)) == null ? void 0 : _a.remove();
      this.card = card;
      _Card.instanceMap.set(card, this);
      _Card.shinyResizeObserver.observe(this.card);
      this._addEventListeners();
      this.overlay = this._createOverlay();
      this._exitFullScreenOnEscape = this._exitFullScreenOnEscape.bind(this);
      this._trapFocusExit = this._trapFocusExit.bind(this);
    }
    /**
     * Enter the card's full screen mode, either programmatically or via an event
     * handler. Full screen mode is activated by adding a class to the card that
     * positions it absolutely and expands it to fill the viewport. In addition,
     * we add a full screen overlay element behind the card and we trap focus in
     * the expanded card while in full screen mode.
     *
     * @param {?Event} [event]
     */
    enterFullScreen(event) {
      var _a;
      if (event)
        event.preventDefault();
      document.addEventListener("keydown", this._exitFullScreenOnEscape, false);
      document.addEventListener("keydown", this._trapFocusExit, true);
      this.card.setAttribute(_Card.attr.ATTR_FULL_SCREEN, "true");
      document.body.classList.add(_Card.attr.CLASS_HAS_FULL_SCREEN);
      this.card.insertAdjacentElement("beforebegin", this.overlay.container);
      if (!this.card.contains(document.activeElement) || ((_a = document.activeElement) == null ? void 0 : _a.classList.contains(
        _Card.attr.CLASS_FULL_SCREEN_ENTER
      ))) {
        this.card.setAttribute("tabindex", "-1");
        this.card.focus();
      }
    }
    /**
     * Exit full screen mode. This removes the full screen overlay element,
     * removes the full screen class from the card, and removes the keyboard event
     * listeners that were added when entering full screen mode.
     */
    exitFullScreen() {
      document.removeEventListener(
        "keydown",
        this._exitFullScreenOnEscape,
        false
      );
      document.removeEventListener("keydown", this._trapFocusExit, true);
      this.overlay.container.remove();
      this.card.setAttribute(_Card.attr.ATTR_FULL_SCREEN, "false");
      this.card.removeAttribute("tabindex");
      document.body.classList.remove(_Card.attr.CLASS_HAS_FULL_SCREEN);
    }
    /**
     * Adds general card-specific event listeners.
     * @private
     */
    _addEventListeners() {
      const btnFullScreen = this.card.querySelector(
        `:scope > * > .${_Card.attr.CLASS_FULL_SCREEN_ENTER}`
      );
      if (!btnFullScreen)
        return;
      btnFullScreen.addEventListener("click", (ev) => this.enterFullScreen(ev));
    }
    /**
     * An event handler to exit full screen mode when the Escape key is pressed.
     * @private
     * @param {KeyboardEvent} event
     */
    _exitFullScreenOnEscape(event) {
      if (!(event.target instanceof HTMLElement))
        return;
      const selOpenSelectInput = ["select[open]", "input[aria-expanded='true']"];
      if (event.target.matches(selOpenSelectInput.join(", ")))
        return;
      if (event.key === "Escape") {
        this.exitFullScreen();
      }
    }
    /**
     * An event handler to trap focus within the card when in full screen mode.
     *
     * @description
     * This keyboard event handler ensures that tab focus stays within the card
     * when in full screen mode. When the card is first expanded,
     * we move focus to the card element itself. If focus somehow leaves the card,
     * we returns focus to the card container.
     *
     * Within the card, we handle only tabbing from the close anchor or the last
     * focusable element and only when tab focus would have otherwise left the
     * card. In those cases, we cycle focus to the last focusable element or back
     * to the anchor. If the card doesn't have any focusable elements, we move
     * focus to the close anchor.
     *
     * @note
     * Because the card contents may change, we check for focusable elements
     * every time the handler is called.
     *
     * @private
     * @param {KeyboardEvent} event
     */
    _trapFocusExit(event) {
      if (!(event instanceof KeyboardEvent))
        return;
      if (event.key !== "Tab")
        return;
      const isFocusedContainer = event.target === this.card;
      const isFocusedAnchor = event.target === this.overlay.anchor;
      const isFocusedWithin = this.card.contains(event.target);
      const stopEvent = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      if (!(isFocusedWithin || isFocusedContainer || isFocusedAnchor)) {
        stopEvent();
        this.card.focus();
        return;
      }
      const focusableElements = getAllFocusableChildren(this.card).filter(
        (el) => !el.classList.contains(_Card.attr.CLASS_FULL_SCREEN_ENTER)
      );
      const hasFocusableElements = focusableElements.length > 0;
      if (!hasFocusableElements) {
        stopEvent();
        this.overlay.anchor.focus();
        return;
      }
      if (isFocusedContainer)
        return;
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const isFocusedLast = event.target === lastFocusable;
      if (isFocusedAnchor && event.shiftKey) {
        stopEvent();
        lastFocusable.focus();
        return;
      }
      if (isFocusedLast && !event.shiftKey) {
        stopEvent();
        this.overlay.anchor.focus();
        return;
      }
    }
    /**
     * Creates the full screen overlay.
     * @private
     * @returns {CardFullScreenOverlay}
     */
    _createOverlay() {
      const container = document.createElement("div");
      container.id = _Card.attr.ID_FULL_SCREEN_OVERLAY;
      container.onclick = this.exitFullScreen.bind(this);
      const anchor = this._createOverlayCloseAnchor();
      container.appendChild(anchor);
      return { container, anchor };
    }
    /**
     * Creates the anchor element used to exit the full screen mode.
     * @private
     * @returns {HTMLAnchorElement}
     */
    _createOverlayCloseAnchor() {
      const anchor = document.createElement("a");
      anchor.classList.add(_Card.attr.CLASS_FULL_SCREEN_EXIT);
      anchor.tabIndex = 0;
      anchor.onclick = () => this.exitFullScreen();
      anchor.onkeydown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          this.exitFullScreen();
        }
      };
      anchor.innerHTML = this._overlayCloseHtml();
      return anchor;
    }
    /**
     * Returns the HTML for the close icon.
     * @private
     * @returns {string}
     */
    _overlayCloseHtml() {
      return "Close <svg width='20' height='20' fill='currentColor' class='bi bi-x-lg' viewBox='0 0 16 16'><path d='M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z'/></svg>";
    }
    /**
     * Returns the card instance associated with the given element, if any.
     * @public
     * @static
     * @param {HTMLElement} el
     * @returns {(Card | undefined)}
     */
    static getInstance(el) {
      return _Card.instanceMap.get(el);
    }
    /**
     * Initializes all cards that require initialization on the page, or schedules
     * initialization if the DOM is not yet ready.
     * @public
     * @static
     * @param {boolean} [flushResizeObserver=true]
     */
    static initializeAllCards(flushResizeObserver = true) {
      if (document.readyState === "loading") {
        if (!_Card.onReadyScheduled) {
          _Card.onReadyScheduled = true;
          document.addEventListener("DOMContentLoaded", () => {
            _Card.initializeAllCards(false);
          });
        }
        return;
      }
      if (flushResizeObserver) {
        _Card.shinyResizeObserver.flush();
      }
      const initSelector = `.${_Card.attr.CLASS_CARD}[${_Card.attr.ATTR_INIT}]`;
      if (!document.querySelector(initSelector)) {
        return;
      }
      const cards = document.querySelectorAll(initSelector);
      cards.forEach((card) => new _Card(card));
    }
  };
  var Card = _Card;
  /**
   * Key bslib-specific classes and attributes used by the card component.
   * @private
   * @static
   * @type {{ ATTR_INIT: string; CLASS_CARD: string; CLASS_FULL_SCREEN: string; CLASS_HAS_FULL_SCREEN: string; CLASS_FULL_SCREEN_ENTER: string; CLASS_FULL_SCREEN_EXIT: string; ID_FULL_SCREEN_OVERLAY: string; }}
   */
  Card.attr = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ATTR_INIT: "data-bslib-card-init",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CLASS_CARD: "bslib-card",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ATTR_FULL_SCREEN: "data-full-screen",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CLASS_HAS_FULL_SCREEN: "bslib-has-full-screen",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CLASS_FULL_SCREEN_ENTER: "bslib-full-screen-enter",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    CLASS_FULL_SCREEN_EXIT: "bslib-full-screen-exit",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ID_FULL_SCREEN_OVERLAY: "bslib-full-screen-overlay"
  };
  /**
   * A Shiny-specific resize observer that ensures Shiny outputs in within the
   * card resize appropriately.
   * @private
   * @type {ShinyResizeObserver}
   * @static
   */
  Card.shinyResizeObserver = new ShinyResizeObserver();
  /**
   * The registry of card instances and their associated DOM elements.
   * @private
   * @static
   * @type {WeakMap<HTMLElement, Card>}
   */
  Card.instanceMap = /* @__PURE__ */ new WeakMap();
  /**
   * If cards are initialized before the DOM is ready, we re-schedule the
   * initialization to occur on DOMContentLoaded.
   * @private
   * @static
   * @type {boolean}
   */
  Card.onReadyScheduled = false;
  window.bslib = window.bslib || {};
  window.bslib.Card = Card;
})();
//# sourceMappingURL=card.js.map
