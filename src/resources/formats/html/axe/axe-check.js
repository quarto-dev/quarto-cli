class QuartoAxeChecker {
  constructor(opts) {
    this.options = opts;
  }
  async init() {
    const axe = (await import("https://cdn.skypack.dev/pin/axe-core@v4.10.3-aVOFXWsJaCpVrtv89pCa/mode=imports,min/optimized/axe-core.js")).default;
    const result = await axe.run({
      preload: { assets: ['cssom'], timeout: 50000 }    
    });
    if (this.options.output === "json") {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    for (const violation of result.violations) {
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

export async function init() {
  const opts = document.querySelector("#quarto-axe-checker-options");
  if (opts) {
    const jsonOptions = JSON.parse(atob(opts.textContent));
    const checker = new QuartoAxeChecker(jsonOptions);
    await checker.init();
  }
}