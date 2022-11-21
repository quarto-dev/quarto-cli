// mermaid-postprocess-shim.js
// code to postprocess mermaid pregenerated HTML, to fix https://github.com/quarto-dev/quarto-cli/issues/1622
//
// Copyright (C) 2022 Posit Software, PBC

const _quartoMermaid = {
  postProcess(el) {
    // recompute foreignObj's height and displacement
    // based on the actual computed style with the existing CSS.
    // this won't be perfect but will be an improvement.
    for (const foreignObj of Array.from(el.querySelectorAll("foreignObject"))) {
      const div = foreignObj.querySelector("div");
      const computedStyle = window.getComputedStyle(div);
      const divHeight = computedStyle.height;
      foreignObj.setAttribute("height", divHeight);

      // this fix is not going to work for animated SVGs coming from mermaid
      // shrug

      // this syntax gives us a string
      const transform = foreignObj.parentElement.getAttribute("transform");
      const m = transform.match(/translate\((.+),(.+)\)/);
      foreignObj.parentElement.setAttribute(
        "transform",
        `translate(${m[1]},${-Number(divHeight.slice(0, -2) / 2)})`
      );
    }
  },
};

// deno-lint-ignore no-window-prefix
window.addEventListener(
  "load",
  function () {
    for (const svgEl of Array.from(
      document.querySelectorAll("div.cell-output-display svg")
    ).filter(
      (el) =>
        el.querySelector("desc").id &&
        el.querySelector("desc").id.startsWith("chart-desc-mermaid")
    )) {
      _quartoMermaid.postProcess(svgEl);
    }
  },
  false
);
