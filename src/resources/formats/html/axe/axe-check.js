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
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  createViolationElement(violation) {
    const violationElement = document.createElement("div");

    const descriptionElement = document.createElement("div");
    descriptionElement.className = "quarto-axe-violation-description";
    descriptionElement.innerText = `${violation.impact.replace(/^[a-z]/, match => match.toLocaleUpperCase())}: ${violation.description}`;
    violationElement.appendChild(descriptionElement);

    const helpElement = document.createElement("div");
    helpElement.className = "quarto-axe-violation-help";
    helpElement.innerText = violation.help;
    violationElement.appendChild(helpElement);

    const nodesElement = document.createElement("div");
    nodesElement.className = "quarto-axe-violation-nodes";
    violationElement.appendChild(nodesElement);
    const nodeElement = document.createElement("div");
    nodeElement.className = "quarto-axe-violation-selector";
    for (const node of violation.nodes) {
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
    this.options = opts;
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

  async init() {
    const axe = (await import("https://cdn.skypack.dev/pin/axe-core@v4.10.3-aVOFXWsJaCpVrtv89pCa/mode=imports,min/optimized/axe-core.js")).default;
    const saved = this.revealUnhideSlides();
    let result;
    try {
      result = await axe.run({
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
    const reporter = this.options === true ? new QuartoAxeConsoleReporter(result) : new reporters[this.options.output](result, this.options);
    await reporter.report();
    document.body.setAttribute('data-quarto-axe-complete', 'true');
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

// Self-initialize when loaded as a standalone module.
// ES modules are deferred, so the DOM is fully parsed when this runs.
init();
