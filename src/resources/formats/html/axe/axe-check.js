// Derive a human-readable WCAG conformance label from axe-core's `tags` array.
// Tags encode the version+level (`wcag2a`, `wcag21aa`), the specific success
// criteria (`wcag111` → 1.1.1), and `best-practice` for axe's own
// recommendations that aren't tied to any WCAG success criterion. Returns "" when
// no conformance tags are present so callers can fall back to the impact alone.
export function axeConformanceLevel(tags) {
  if (tags.includes("best-practice")) return "Best Practice";

  // Version+level: wcag2a, wcag2aa, wcag21aa, wcag22aa, ... An `-obsolete`
  // suffix (e.g. `wcag2a-obsolete` on the deprecated `duplicate-id` rule) marks
  // a criterion that was withdrawn from later WCAG versions, e.g. SC 4.1.1,
  // removed in WCAG 2.2. We surface the original level but flag it as obsolete
  // so a withdrawn criterion isn't mistaken for a current conformance failure.
  const versionTag = tags.find((t) => /^wcag\d+a+(-obsolete)?$/.test(t));
  // Without a version+level tag there's no conformance level to report, so fall
  // back to the impact alone rather than emitting a bare, level-less criterion.
  if (!versionTag) return "";

  const [, major, minor, level, obsolete] =
    versionTag.match(/^wcag(\d)(\d?)(a+)(-obsolete)?$/);
  let label = `WCAG ${major}.${minor || "0"} ${level.toUpperCase()}`;

  // Success criteria: wcag111 → 1.1.1, wcag1410 → 1.4.10. Principle and
  // guideline are always single digits; the remainder is the criterion number.
  const criteria = tags
    .filter((t) => /^wcag\d{3,}$/.test(t))
    .map((t) => {
      const d = t.slice(4);
      return `${d[0]}.${d[1]}.${d.slice(2)}`;
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (criteria.length) {
    label += ` (${criteria.join(", ")})`;
  }
  return obsolete ? `Obsolete ${label}` : label;
}

// Margin kept between the viewport top and an element too tall to center in
// the band above the report overlay.
const OVERLAY_SCROLL_MARGIN = 16;

// Compute the document scrollTop that positions an element in the viewport band
// the fixed report overlay does NOT cover, so scrolling a highlighted element
// into view can't park it underneath the report. The overlay is bottom-anchored,
// so that band runs from the viewport top down to the overlay's top edge.
// Returns null when default `block: "center"` scrolling can't be obscured (no
// horizontal overlap with the overlay) or when the overlay leaves no usable
// band. All inputs are viewport-relative rects plus scroll state, so this stays
// a pure function (unit-testable without a DOM, like axeConformanceLevel).
export function overlayAwareScrollTop(
  elementRect,
  overlayRect,
  viewportHeight,
  scrollY,
) {
  // Element entirely left of the overlay: centering can't obscure it.
  if (elementRect.right <= overlayRect.left) return null;

  const bandHeight = Math.min(overlayRect.top, viewportHeight);
  if (bandHeight <= OVERLAY_SCROLL_MARGIN * 2) return null;

  const offset = elementRect.height > bandHeight
    // Too tall to fit in the band: align its start just inside the top.
    ? OVERLAY_SCROLL_MARGIN
    // Otherwise center it within the band.
    : bandHeight / 2 - elementRect.height / 2;
  return Math.max(0, scrollY + elementRect.top - offset);
}

class QuartoAxeReporter {
  constructor(axeResult, options) {
    this.axeResult = axeResult;
    this.options = options;
  }

  report() {
    throw new Error("report() is an abstract method");
  }
}

class QuartoAxeJsonReporter extends QuartoAxeReporter {
  constructor(axeResult, options) {
    super(axeResult, options);
  }

  report() {
    console.log(JSON.stringify(this.axeResult, null, 2));
  }
}

class QuartoAxeConsoleReporter extends QuartoAxeReporter {
  constructor(axeResult, options) {
    super(axeResult, options);
  }

  report() {
    for (const violation of this.axeResult.violations) {
      console.log(violation.description);
      for (const node of violation.nodes) {
        for (const target of node.target) {
          console.log(target);
          console.log(document.querySelector(target));
        }
      }
    }
  }
}

class QuartoAxeDocumentReporter extends QuartoAxeReporter {
  constructor(axeResult, options) {
    super(axeResult, options);
  }

  highlightTarget(target) {
    const element = document.querySelector(target);
    if (!element) return null;
    this.navigateToElement(element);
    element.classList.add("quarto-axe-hover-highlight");
    return element;
  }

  unhighlightTarget(target) {
    const element = document.querySelector(target);
    if (element) element.classList.remove("quarto-axe-hover-highlight");
  }

  navigateToElement(element) {
    if (typeof Reveal !== "undefined") {
      const section = element.closest("section");
      if (section) {
        const indices = Reveal.getIndices(section);
        Reveal.slide(indices.h, indices.v);
      } else {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      // Only the plain-HTML fixed overlay can obscure a centered element:
      // Reveal navigates slides, and the dashboard offcanvas is a static,
      // full-height side panel that vertical scrolling can't dodge.
      const report = document.querySelector(".quarto-axe-report");
      if (report && getComputedStyle(report).position === "fixed") {
        const top = overlayAwareScrollTop(
          element.getBoundingClientRect(),
          report.getBoundingClientRect(),
          window.innerHeight,
          window.scrollY,
        );
        if (top !== null) {
          window.scrollTo({ top, behavior: "smooth" });
          return;
        }
      }
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  createViolationElement(violation) {
    const violationElement = document.createElement("div");

    const descriptionElement = document.createElement("div");
    descriptionElement.className = "quarto-axe-violation-description";
    const impact = violation.impact.replace(/^[a-z]/, match => match.toLocaleUpperCase());
    const level = axeConformanceLevel(violation.tags);
    const prefix = level ? `${impact} · ${level}` : impact;
    descriptionElement.innerText = `${prefix}: ${violation.description}`;
    violationElement.appendChild(descriptionElement);

    const helpElement = document.createElement("div");
    helpElement.className = "quarto-axe-violation-help";
    helpElement.innerText = violation.help;
    violationElement.appendChild(helpElement);

    const nodesElement = document.createElement("div");
    nodesElement.className = "quarto-axe-violation-nodes";
    violationElement.appendChild(nodesElement);
    for (const node of violation.nodes) {
      const nodeElement = document.createElement("div");
      nodeElement.className = "quarto-axe-violation-selector";
      for (const target of node.target) {
        const targetElement = document.createElement("span");
        targetElement.className = "quarto-axe-violation-target";
        targetElement.innerText = target;
        nodeElement.appendChild(targetElement);
        if (typeof Reveal !== "undefined") {
          // RevealJS: click navigates to the slide and highlights briefly
          nodeElement.addEventListener("click", () => {
            const el = this.highlightTarget(target);
            if (el) setTimeout(() => el.classList.remove("quarto-axe-hover-highlight"), 3000);
          });
        } else {
          // HTML/Dashboard: hover highlights while mouse is over the target
          nodeElement.addEventListener("mouseenter", () => this.highlightTarget(target));
          nodeElement.addEventListener("mouseleave", () => this.unhighlightTarget(target));
        }
      }
      nodesElement.appendChild(nodeElement);
    }
    return violationElement;
  }

  createReportElement() {
    const violations = this.axeResult.violations;
    const reportElement = document.createElement("div");
    reportElement.className = "quarto-axe-report";
    if (violations.length === 0) {
      const noViolationsElement = document.createElement("div");
      noViolationsElement.className = "quarto-axe-no-violations";
      noViolationsElement.innerText = "No axe-core violations found.";
      reportElement.appendChild(noViolationsElement);
    }
    violations.forEach((violation) => {
      reportElement.appendChild(this.createViolationElement(violation));
    });
    return reportElement;
  }

  createReportOverlay() {
    const reportElement = this.createReportElement();
    (document.querySelector("main") || document.body).appendChild(reportElement);
  }

  createReportSlide() {
    const slidesContainer = document.querySelector(".reveal .slides");
    if (!slidesContainer) {
      this.createReportOverlay();
      return;
    }

    const section = document.createElement("section");
    section.className = "slide quarto-axe-report-slide scrollable";
    // Force a white slide background so the report stays readable regardless
    // of the deck's brand/theme colors. Reveal applies this to the slide's
    // generated `.slide-background` element during sync().
    section.setAttribute("data-background-color", "#fff");

    const title = document.createElement("h2");
    title.textContent = "Accessibility Report";
    section.appendChild(title);

    section.appendChild(this.createReportElement());
    slidesContainer.appendChild(section);

    // sync() registers the new slide but doesn't update visibility classes.
    // Re-navigating to the current slide triggers the visibility update so
    // the report slide gets the correct past/present/future class.
    const indices = Reveal.getIndices();
    Reveal.sync();
    Reveal.slide(indices.h, indices.v);
  }

  createReportOffcanvas() {
    const offcanvas = document.createElement("div");
    offcanvas.className = "offcanvas offcanvas-end quarto-axe-offcanvas";
    offcanvas.id = "quarto-axe-offcanvas";
    offcanvas.tabIndex = -1;
    offcanvas.setAttribute("aria-labelledby", "quarto-axe-offcanvas-label");
    offcanvas.setAttribute("data-bs-scroll", "true");
    offcanvas.setAttribute("data-bs-backdrop", "false");

    const header = document.createElement("div");
    header.className = "offcanvas-header";

    const title = document.createElement("h5");
    title.className = "offcanvas-title";
    title.id = "quarto-axe-offcanvas-label";
    title.textContent = "Accessibility Report";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn-close";
    closeBtn.setAttribute("data-bs-dismiss", "offcanvas");
    closeBtn.setAttribute("aria-label", "Close");
    header.appendChild(closeBtn);

    offcanvas.appendChild(header);

    const body = document.createElement("div");
    body.className = "offcanvas-body";
    body.appendChild(this.createReportElement());
    offcanvas.appendChild(body);

    document.body.appendChild(offcanvas);

    const toggle = document.createElement("button");
    toggle.className = "btn btn-dark quarto-axe-toggle";
    toggle.type = "button";
    toggle.setAttribute("data-bs-toggle", "offcanvas");
    toggle.setAttribute("data-bs-target", "#quarto-axe-offcanvas");
    toggle.setAttribute("aria-controls", "quarto-axe-offcanvas");
    toggle.setAttribute("aria-label", "Toggle accessibility report");

    const icon = document.createElement("i");
    icon.className = "bi bi-universal-access";
    toggle.appendChild(icon);

    document.body.appendChild(toggle);

    new bootstrap.Offcanvas(offcanvas).show();
  }

  report() {
    if (typeof Reveal !== "undefined") {
      if (Reveal.isReady()) {
        this.createReportSlide();
      } else {
        return new Promise((resolve) => {
          Reveal.on("ready", () => {
            this.createReportSlide();
            resolve();
          });
        });
      }
    } else if (document.body.classList.contains("quarto-dashboard")) {
      this.createReportOffcanvas();
    } else {
      this.createReportOverlay();
    }
  }
}

const reporters = {
  json: QuartoAxeJsonReporter,
  console: QuartoAxeConsoleReporter,
  document: QuartoAxeDocumentReporter,
};

class QuartoAxeChecker {
  constructor(opts) {
    // Normalize boolean shorthand: axe: true → {output: "console"}
    this.options = opts === true ? { output: "console" } : opts;
    this.axe = null;
    this.scanGeneration = 0;
  }
  // In RevealJS, only the current slide is accessible to axe-core because
  // non-visible slides have hidden and aria-hidden attributes. Temporarily
  // remove these so axe can check all slides, then restore them.
  revealUnhideSlides() {
    const slides = document.querySelectorAll(".reveal .slides section");
    if (slides.length === 0) return null;
    const saved = [];
    slides.forEach((s) => {
      saved.push({
        el: s,
        hidden: s.hasAttribute("hidden"),
        ariaHidden: s.getAttribute("aria-hidden"),
      });
      s.removeAttribute("hidden");
      s.removeAttribute("aria-hidden");
    });
    return saved;
  }

  revealRestoreSlides(saved) {
    if (!saved) return;
    saved.forEach(({ el, hidden, ariaHidden }) => {
      if (hidden) el.setAttribute("hidden", "");
      if (ariaHidden !== null) el.setAttribute("aria-hidden", ariaHidden);
    });
  }

  async runAxeScan() {
    const saved = this.revealUnhideSlides();
    try {
      return await this.axe.run({
        exclude: [
         // https://github.com/microsoft/tabster/issues/288
         // MS has claimed they won't fix this, so we need to add an exclusion to
         // all tabster elements
         "[data-tabster-dummy]"
        ],
        preload: { assets: ['cssom'], timeout: 50000 }
      });
    } finally {
      this.revealRestoreSlides(saved);
    }
  }

  setupDashboardRescan() {
    // Page tabs and card tabsets both fire shown.bs.tab on the document
    document.addEventListener("shown.bs.tab", () => this.rescanDashboard());

    // Browser back/forward — showPage() toggles classes without firing shown.bs.tab.
    // The 50ms delay lets the dashboard finish toggling .active classes on tab panes
    // before axe scans, so the correct page content is visible.
    window.addEventListener("popstate", () => {
      setTimeout(() => this.rescanDashboard(), 50);
    });

    // bslib sidebar open/close — fires with bubbles:true after transition ends
    document.addEventListener("bslib.sidebar", () => this.rescanDashboard());
  }

  async rescanDashboard() {
    const gen = ++this.scanGeneration;

    document.body.removeAttribute("data-quarto-axe-complete");

    const body = document.querySelector("#quarto-axe-offcanvas .offcanvas-body");
    if (body) {
      body.innerHTML = "";
      const scanning = document.createElement("div");
      scanning.className = "quarto-axe-scanning";
      scanning.textContent = "Scanning\u2026";
      body.appendChild(scanning);
    }

    try {
      const result = await this.runAxeScan();

      if (gen !== this.scanGeneration) return;

      const reporter = new QuartoAxeDocumentReporter(result, this.options);
      const reportElement = reporter.createReportElement();

      if (body) {
        body.innerHTML = "";
        body.appendChild(reportElement);
      }
    } catch (error) {
      console.error("Axe rescan failed:", error);
      if (gen !== this.scanGeneration) return;
      if (body) {
        body.innerHTML = "";
        const msg = document.createElement("div");
        msg.className = "quarto-axe-scanning";
        msg.setAttribute("role", "alert");
        msg.textContent = "Accessibility scan failed. See console for details.";
        body.appendChild(msg);
      }
    } finally {
      if (gen === this.scanGeneration) {
        document.body.setAttribute("data-quarto-axe-complete", "true");
      }
    }
  }

  async init() {
    try {
      // set by the vendored axe.min.js, a classic script that runs before this module
      this.axe = window.axe;
      // Deferred modules run before DOMContentLoaded, but the dashboard layout
      // runs on DOMContentLoaded and keeps <html> hidden until then — and axe
      // skips hidden elements. Wait for full page load before the first scan.
      // (The Skypack import's network latency used to mask this race.)
      if (document.readyState !== "complete") {
        await new Promise((resolve) =>
          window.addEventListener("load", resolve, { once: true })
        );
      }
      const result = await this.runAxeScan();
      const reporter = new reporters[this.options.output](result, this.options);
      await reporter.report();

      if (document.body.classList.contains("quarto-dashboard") &&
          this.options.output === "document") {
        this.setupDashboardRescan();
      }
    } catch (error) {
      console.error("Axe accessibility check failed:", error);
    } finally {
      document.body.setAttribute('data-quarto-axe-complete', 'true');
    }
  }
}

let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;
  const opts = document.querySelector("#quarto-axe-checker-options");
  if (opts) {
    const jsonOptions = JSON.parse(atob(opts.textContent));
    const checker = new QuartoAxeChecker(jsonOptions);
    await checker.init();
  }
}

// Self-initialize when loaded as a standalone module in a browser. ES modules
// are deferred, so the DOM is fully parsed when this runs. The `document` guard
// keeps the module side-effect-free when imported outside a browser (e.g. unit
// tests that exercise axeConformanceLevel directly).
if (typeof document !== "undefined") {
  init();
}
