import { baseHandler, LanguageCellHandlerContext } from "./types.ts";
import { install } from "./base.ts";
import { kIncludeAfterBody } from "../../config/constants.ts";
import { formatResourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import {
  isJavascriptCompatible,
  isMarkdownOutput,
} from "../../config/format.ts";

install("mermaid", {
  ...baseHandler,

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
    cell: string,
  ) {
    if (isJavascriptCompatible(handlerContext.options.format)) {
      return `\n<pre class="mermaid">\n${cell}\n</pre>\n`;
    } else if (
      isMarkdownOutput(handlerContext.options.format.pandoc, ["gfm"])
    ) {
      return `\n\`\`\` mermaid\n${cell}\n\`\`\`\n`;
    } else {
      return "";
    }
  },
});
