mermaid.initialize({ startOnLoad: false });
// deno-lint-ignore no-window-prefix
window.addEventListener(
  "load",
  function () {
    mermaid.init("div.cell-output-display pre.mermaid");
  },
  false
);
