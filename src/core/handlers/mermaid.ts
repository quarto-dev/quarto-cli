import { baseHandler, HandlerContext } from "./types.ts";
import { install } from "./base.ts";

install("mermaid", {
  ...baseHandler,

  // called once per document, no cells in particular
  documentStart(
    handlerContext: HandlerContext,
  ) {
    if (handlerContext.format === "html") {
      handlerContext.addInclude(
        `<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js">`,
        "beforeBody",
      );
      handlerContext.addInclude(
        `<script>mermaid.initialize({ startOnLoad: true });</script>`,
        "afterBody",
      );
    }
  },

  cell(
    _handlerContext: HandlerContext,
    cell: string,
  ) {
    return `\n::: .mermaid\n${cell}\n:::`;
  },
});
