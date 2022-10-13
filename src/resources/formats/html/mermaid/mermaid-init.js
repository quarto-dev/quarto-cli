// mermaid-init.js
// Initializes the quarto-mermaid JS runtime
//
// Copyright (C) 2022 by RStudio, PBC

/**
 * String.prototype.replaceAll() polyfill
 * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
 * @author Chris Ferdinandi
 * @license MIT
 */
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function (str, newStr) {
    // If a regex pattern
    if (
      Object.prototype.toString.call(str).toLowerCase() === "[object regexp]"
    ) {
      return this.replace(str, newStr);
    }

    // If a string
    return this.replace(new RegExp(str, "g"), newStr);
  };
}

mermaid.initialize({ startOnLoad: false });

const _quartoMermaid = {
  // NB: there's effectively a copy of this function
  // in `core/svg.ts`.
  // if you change something here, you must keep it consistent there as well.
  setSvgSize(svg) {
    const { widthInPoints, heightInPoints } = this.resolveSize(svg);

    svg.setAttribute("width", widthInPoints);
    svg.setAttribute("height", heightInPoints);
    svg.style.maxWidth = null; // clear preset mermaid value.
  },

  // NB: there's effectively a copy of this function
  // in `core/svg.ts`.
  // if you change something here, you must keep it consistent there as well.
  makeResponsive(svg) {
    const width = svg.getAttribute("width");
    if (width === null) {
      throw new Error("Couldn't find SVG width");
    }
    const numWidth = Number(width.slice(0, -2));

    if (numWidth > 650) {
      changed = true;
      svg.setAttribute("width", "100%");
      svg.removeAttribute("height");
    }
  },

  // NB: there's effectively a copy of this function
  // in `core/svg.ts`.
  // if you change something here, you must keep it consistent there as well.
  fixupAlignment(svg, align) {
    let style = svg.getAttribute("style") || "";

    switch (align) {
      case "left":
        style = `${style} display: block; margin: auto auto auto 0`;
        break;
      case "right":
        style = `${style} display: block; margin: auto 0 auto auto`;
        break;
      case "center":
        style = `${style} display: block; margin: auto auto auto auto`;
        break;
    }
    svg.setAttribute("style", style);
  },

  resolveOptions(svgEl) {
    return svgEl.parentElement.parentElement.parentElement.parentElement
      .dataset;
  },

  // NB: there's effectively a copy of this function
  // in our mermaid runtime in `core/svg.ts`.
  // if you change something here, you must keep it consistent there as well.
  resolveSize(svgEl) {
    const inInches = (size) => {
      if (size.endsWith("in")) {
        return Number(size.slice(0, -2));
      }
      if (size.endsWith("pt") || size.endsWith("px")) {
        // assume 96 dpi for now
        return Number(size.slice(0, -2)) / 96;
      }
      return Number(size);
    };

    // these are figWidth and figHeight on purpose,
    // because data attributes are translated to camelCase by the DOM API
    const kFigWidth = "figWidth",
      kFigHeight = "figHeight";
    const options = this.resolveOptions(svgEl);
    const width = svgEl.getAttribute("width");
    const height = svgEl.getAttribute("height");
    if (!width || !height) {
      // attempt to resolve figure dimensions via viewBox
      throw new Error("Internal error: couldn't find figure dimensions");
    }
    const getViewBox = () => {
      const vb = svgEl.attributes.getNamedItem("viewBox").value; // do it the roundabout way so that viewBox isn't dropped by deno_dom and text/html
      if (!vb) return undefined;
      const lst = vb.trim().split(" ").map(Number);
      if (lst.length !== 4) return undefined;
      if (lst.some(isNaN)) return undefined;
      return lst;
    };

    let svgWidthInInches, svgHeightInInches;

    if (
      (width.slice(0, -2) === "pt" && height.slice(0, -2) === "pt") ||
      (width.slice(0, -2) === "px" && height.slice(0, -2) === "px") ||
      (!isNaN(Number(width)) && !isNaN(Number(height)))
    ) {
      // we assume 96 dpi which is generally what seems to be used.
      svgWidthInInches = Number(width.slice(0, -2)) / 96;
      svgHeightInInches = Number(height.slice(0, -2)) / 96;
    }
    const viewBox = getViewBox();
    if (viewBox !== undefined) {
      // assume width and height come from viewbox.
      const [_mx, _my, vbWidth, vbHeight] = viewBox;
      svgWidthInInches = vbWidth / 96;
      svgHeightInInches = vbHeight / 96;
    } else {
      throw new Error(
        "Internal Error: Couldn't resolve width and height of SVG"
      );
    }
    const svgWidthOverHeight = svgWidthInInches / svgHeightInInches;
    let widthInInches, heightInInches;

    if (options[kFigWidth] && options[kFigHeight]) {
      // both were prescribed, so just go with them
      widthInInches = inInches(String(options[kFigWidth]));
      heightInInches = inInches(String(options[kFigHeight]));
    } else if (options[kFigWidth]) {
      // we were only given width, use that and adjust height based on aspect ratio;
      widthInInches = inInches(String(options[kFigWidth]));
      heightInInches = widthInInches / svgWidthOverHeight;
    } else if (options[kFigHeight]) {
      // we were only given height, use that and adjust width based on aspect ratio;
      heightInInches = inInches(String(options[kFigHeight]));
      widthInInches = heightInInches * svgWidthOverHeight;
    } else {
      // we were not given either, use svg's prescribed height
      heightInInches = svgHeightInInches;
      widthInInches = svgWidthInInches;
    }

    return {
      widthInInches,
      heightInInches,
      widthInPoints: Math.round(widthInInches * 96),
      heightInPoints: Math.round(heightInInches * 96),
    };
  },

  postProcess(svg) {
    const options = this.resolveOptions(svg);
    if (
      options.responsive &&
      options["figWidth"] === undefined &&
      options["figHeight"] === undefined
    ) {
      this.makeResponsive(svg);
    } else {
      this.setSvgSize(svg);
    }
    if (options["reveal"]) {
      this.fixupAlignment(svg, options["figAlign"] || "center");
    }
  },
};

// deno-lint-ignore no-window-prefix
window.addEventListener(
  "load",
  function () {
    mermaid.init("pre.mermaid-js");
    for (const svgEl of Array.from(
      document.querySelectorAll("pre.mermaid-js svg")
    )) {
      _quartoMermaid.postProcess(svgEl);
    }
  },
  false
);
