/*
* mermaid.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { kIncludeAfterBody } from "../../config/constants.ts";
import { formatResourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import {
  isJavascriptCompatible,
  isMarkdownOutput,
} from "../../config/format.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import { mappedConcat } from "../lib/mapped-text.ts";
import { schemaFromString } from "../lib/yaml-schema/from-yaml.ts";

import { pandocHtmlBlock, pandocRawStr } from "../pandoc/codegen.ts";

const mermaidHandler: LanguageHandler = {
  ...baseHandler,

  handlerType: "cell",

  languageName: "mermaid",

  defaultOptions: {
    echo: false,
    eval: true,
    "code-fold": false,
    include: true,
  },

  comment: "%%",

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
        `<script>
        mermaid.initialize({ startOnLoad: false });
        window.addEventListener(
          'load',
          function () {
            debugger;
            mermaid.init("div.cell-output-display > pre.mermaid");
          },
          false
        );
        </script>`,
        kIncludeAfterBody,
      );
    }
  },

  cell(
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
  ) {
    if (isJavascriptCompatible(handlerContext.options.format)) {
      const preEl = pandocHtmlBlock("pre")({
        classes: ["mermaid"],
      });
      preEl.push(pandocRawStr(cell.source));

      return this.build(handlerContext, cell, preEl.mappedString());
    } else if (
      isMarkdownOutput(handlerContext.options.format.pandoc, ["gfm"])
    ) {
      return this.build(
        handlerContext,
        cell,
        mappedConcat(["\n``` mermaid\n", cell.source, "\n```\n"]),
      );
    } else {
      return cell.source;
    }
  },
};

install(mermaidHandler);
