/*! bslib 0.5.1 | (c) 2012-2023 RStudio, PBC. | License: MIT + file LICENSE */
"use strict";
(() => {
  // srcts/src/components/_utils.ts
  var InputBinding = window.Shiny ? Shiny.InputBinding : class {
  };
  function registerBinding(inputBindingClass, name) {
    if (window.Shiny) {
      Shiny.inputBindings.register(new inputBindingClass(), "bslib." + name);
    }
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

  // srcts/src/components/sidebar.ts
  var _Sidebar = class {
    /**
     * Creates an instance of a collapsible bslib Sidebar.
     * @constructor
     * @param {HTMLElement} container
     */
    constructor(container) {
      _Sidebar.instanceMap.set(container, this);
      this.layout = {
        container,
        main: container.querySelector(":scope > .main"),
        sidebar: container.querySelector(":scope > .sidebar"),
        toggle: container.querySelector(
          ":scope > .collapse-toggle"
        )
      };
      if (!this.layout.toggle) {
        throw new Error("Tried to initialize a non-collapsible sidebar.");
      }
      const sideAccordion = this.layout.sidebar.querySelector(
        ":scope > .sidebar-content > .accordion"
      );
      if (sideAccordion)
        sideAccordion.classList.add("accordion-flush");
      this._initEventListeners();
      this._initSidebarCounters();
      this._initDesktop();
      _Sidebar.shinyResizeObserver.observe(this.layout.main);
      container.removeAttribute("data-bslib-sidebar-init");
      const initScript = container.querySelector(
        ":scope > script[data-bslib-sidebar-init]"
      );
      if (initScript) {
        container.removeChild(initScript);
      }
    }
    /**
     * Read the current state of the sidebar. Note that, when calling this method,
     * the sidebar may be transitioning into the state returned by this method.
     *
     * @description
     * The sidebar state works as follows, starting from the open state. When the
     * sidebar is closed:
     * 1. We add both the `COLLAPSE` and `TRANSITIONING` classes to the sidebar.
     * 2. The sidebar collapse begins to animate. On desktop devices, and where it
     *    is supported, we transition the `grid-template-columns` property of the
     *    sidebar layout. On mobile, the sidebar is hidden immediately. In both
     *    cases, the collapse icon rotates and we use this rotation to determine
     *    when the transition is complete.
     * 3. If another sidebar state toggle is requested while closing the sidebar,
     *    we remove the `COLLAPSE` class and the animation immediately starts to
     *    reverse.
     * 4. When the `transition` is complete, we remove the `TRANSITIONING` class.
     * @readonly
     * @type {boolean}
     */
    get isClosed() {
      return this.layout.container.classList.contains(_Sidebar.classes.COLLAPSE);
    }
    /**
     * Given a sidebar container, return the Sidebar instance associated with it.
     * @public
     * @static
     * @param {HTMLElement} el
     * @returns {(Sidebar | undefined)}
     */
    static getInstance(el) {
      return _Sidebar.instanceMap.get(el);
    }
    /**
     * Initialize all collapsible sidebars on the page.
     * @public
     * @static
     * @param {boolean} [flushResizeObserver=true] When `true`, we remove
     * non-existent elements from the ResizeObserver. This is required
     * periodically to prevent memory leaks. To avoid over-checking, we only flush
     * the ResizeObserver when initializing sidebars after page load.
     */
    static initCollapsibleAll(flushResizeObserver = true) {
      if (document.readyState === "loading") {
        if (!_Sidebar.onReadyScheduled) {
          _Sidebar.onReadyScheduled = true;
          document.addEventListener("DOMContentLoaded", () => {
            _Sidebar.initCollapsibleAll(false);
          });
        }
        return;
      }
      const initSelector = `.${_Sidebar.classes.LAYOUT}[data-bslib-sidebar-init]`;
      if (!document.querySelector(initSelector)) {
        return;
      }
      if (flushResizeObserver)
        _Sidebar.shinyResizeObserver.flush();
      const containers = document.querySelectorAll(initSelector);
      containers.forEach((container) => new _Sidebar(container));
    }
    /**
     * Initialize event listeners for the sidebar toggle button.
     * @private
     */
    _initEventListeners() {
      var _a;
      const { toggle } = this.layout;
      toggle.addEventListener("click", (ev) => {
        ev.preventDefault();
        this.toggle("toggle");
      });
      (_a = toggle.querySelector(".collapse-icon")) == null ? void 0 : _a.addEventListener("transitionend", () => this._finalizeState());
    }
    /**
     * Initialize nested sidebar counters.
     *
     * @description
     * This function walks up the DOM tree, adding CSS variables to each direct
     * parent sidebar layout that count the layout's position in the stack of
     * nested layouts. We use these counters to keep the collapse toggles from
     * overlapping. Note that always-open sidebars that don't have collapse
     * toggles break the chain of nesting.
     * @private
     */
    _initSidebarCounters() {
      const { container } = this.layout;
      const selectorChildLayouts = `.${_Sidebar.classes.LAYOUT}> .main > .${_Sidebar.classes.LAYOUT}:not([data-bslib-sidebar-open="always"])`;
      const isInnermostLayout = container.querySelector(selectorChildLayouts) === null;
      if (!isInnermostLayout) {
        return;
      }
      function nextSidebarParent(el) {
        el = el ? el.parentElement : null;
        if (el && el.classList.contains("main")) {
          el = el.parentElement;
        }
        if (el && el.classList.contains(_Sidebar.classes.LAYOUT)) {
          return el;
        }
        return null;
      }
      const layouts = [container];
      let parent = nextSidebarParent(container);
      while (parent) {
        layouts.unshift(parent);
        parent = nextSidebarParent(parent);
      }
      const count = { left: 0, right: 0 };
      layouts.forEach(function(x, i) {
        x.style.setProperty("--bslib-sidebar-counter", i.toString());
        const isRight = x.classList.contains("sidebar-right");
        const thisCount = isRight ? count.right++ : count.left++;
        x.style.setProperty(
          "--bslib-sidebar-overlap-counter",
          thisCount.toString()
        );
      });
    }
    /**
     * Initialize the sidebar's initial state when `open = "desktop"`.
     * @private
     */
    _initDesktop() {
      var _a;
      const { container } = this.layout;
      if (((_a = container.dataset.bslibSidebarOpen) == null ? void 0 : _a.trim()) !== "desktop") {
        return;
      }
      const initCollapsed = window.getComputedStyle(container).getPropertyValue("--bslib-sidebar-js-init-collapsed");
      if (initCollapsed.trim() === "true") {
        this.toggle("close");
      }
    }
    /**
     * Toggle the sidebar's open/closed state.
     * @public
     * @param {SidebarToggleMethod | undefined} method Whether to `"open"`,
     * `"close"` or `"toggle"` the sidebar. If `.toggle()` is called without an
     * argument, it will toggle the sidebar's state.
     */
    toggle(method) {
      if (typeof method === "undefined") {
        method = "toggle";
      }
      const { container, sidebar } = this.layout;
      const isClosed = this.isClosed;
      if (["open", "close", "toggle"].indexOf(method) === -1) {
        throw new Error(`Unknown method ${method}`);
      }
      if (method === "toggle") {
        method = isClosed ? "open" : "close";
      }
      if (isClosed && method === "close" || !isClosed && method === "open") {
        return;
      }
      if (method === "open") {
        sidebar.hidden = false;
      }
      container.classList.add(_Sidebar.classes.TRANSITIONING);
      container.classList.toggle(_Sidebar.classes.COLLAPSE);
    }
    /**
     * When the sidebar open/close transition ends, finalize the sidebar's state.
     * @private
     */
    _finalizeState() {
      const { container, sidebar, toggle } = this.layout;
      container.classList.remove(_Sidebar.classes.TRANSITIONING);
      sidebar.hidden = this.isClosed;
      toggle.setAttribute("aria-expanded", this.isClosed ? "false" : "true");
      const event = new CustomEvent("bslib.sidebar", {
        bubbles: true,
        detail: { open: !this.isClosed }
      });
      sidebar.dispatchEvent(event);
      $(sidebar).trigger("toggleCollapse.sidebarInputBinding");
      $(sidebar).trigger(this.isClosed ? "hidden" : "shown");
    }
  };
  var Sidebar = _Sidebar;
  /**
   * A Shiny-specific resize observer that ensures Shiny outputs in the main
   * content areas of the sidebar resize appropriately.
   * @private
   * @type {ShinyResizeObserver}
   * @static
   */
  Sidebar.shinyResizeObserver = new ShinyResizeObserver();
  /**
   * Static classes related to the sidebar layout or state.
   * @public
   * @static
   * @readonly
   * @type {{ LAYOUT: string; COLLAPSE: string; TRANSITIONING: string; }}
   */
  Sidebar.classes = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    LAYOUT: "bslib-sidebar-layout",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    COLLAPSE: "sidebar-collapsed",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    TRANSITIONING: "transitioning"
  };
  /**
   * If sidebars are initialized before the DOM is ready, we re-schedule the
   * initialization to occur on DOMContentLoaded.
   * @private
   * @static
   * @type {boolean}
   */
  Sidebar.onReadyScheduled = false;
  /**
   * A map of initialized sidebars to their respective Sidebar instances.
   * @private
   * @static
   * @type {WeakMap<HTMLElement, Sidebar>}
   */
  Sidebar.instanceMap = /* @__PURE__ */ new WeakMap();
  var SidebarInputBinding = class extends InputBinding {
    find(scope) {
      return $(scope).find(`.${Sidebar.classes.LAYOUT} > .bslib-sidebar-input`);
    }
    getValue(el) {
      const sb = Sidebar.getInstance(el.parentElement);
      if (!sb)
        return false;
      return !sb.isClosed;
    }
    setValue(el, value) {
      const method = value ? "open" : "close";
      this.receiveMessage(el, { method });
    }
    subscribe(el, callback) {
      $(el).on(
        "toggleCollapse.sidebarInputBinding",
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        function(event) {
          callback(true);
        }
      );
    }
    unsubscribe(el) {
      $(el).off(".sidebarInputBinding");
    }
    receiveMessage(el, data) {
      const sb = Sidebar.getInstance(el.parentElement);
      if (sb)
        sb.toggle(data.method);
    }
  };
  registerBinding(SidebarInputBinding, "sidebar");
  window.bslib = window.bslib || {};
  window.bslib.Sidebar = Sidebar;
})();
//# sourceMappingURL=sidebar.js.map
