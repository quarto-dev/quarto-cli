import { LanguageCellHandlerContext } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { kIncludeAfterBody } from "../../config/constants.ts";
import { formatResourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import {
  isJavascriptCompatible,
  isMarkdownOutput,
} from "../../config/format.ts";
import { QuartoMdCell } from "../break-quarto-md.ts";
import { mappedConcat } from "../lib/mapped-text.ts";

install("mermaid", {
  ...baseHandler,

  comment: { prefix: "%%" },

  // called once per document, no cells in particular
  documentStart(
    handlerContext: LanguageCellHandlerContext,
  ) {
    if (isJavascriptCompatible(handlerContext.options.format)) {
      handlerContext.addDependency(
        "script",
        {
          name: "mermaid.min.js",
          path: formatResourcePath("html", join("mermaid", "mermaid.min.js")),
        },
      );

      handlerContext.addInclude(
        `<script>mermaid.initialize({ startOnLoad: true });</script>`,
        kIncludeAfterBody,
      );
    }
  },

  cell(
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
  ) {
    if (isJavascriptCompatible(handlerContext.options.format)) {
      return mappedConcat([
        `\n<pre class="mermaid">`,
        cell.source,
        `\n</pre>\n`,
      ]);
    } else if (
      isMarkdownOutput(handlerContext.options.format.pandoc, ["gfm"])
    ) {
      return mappedConcat(["\n``` mermaid\n", cell.source, "\n```\n"]);
    } else {
      return cell.source;
    }
  },
});
