/*
* mermaid.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import {
  LanguageCellHandlerContext,
  LanguageCellHandlerOptions,
  LanguageHandler,
} from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { formatResourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import {
  isJavascriptCompatible,
  isMarkdownOutput,
} from "../../config/format.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import { asMappedString, mappedConcat } from "../lib/mapped-text.ts";

import {
  extractHtmlFromElements,
  extractImagesFromElements,
} from "../puppeteer.ts";

let globalFigureCounter = 0;

const mermaidHandler: LanguageHandler = {
  ...baseHandler,

  type: "cell",
  stage: "post-engine",

  languageName: "mermaid",
  languageClass: (options: LanguageCellHandlerOptions) => {
    if (isMarkdownOutput(options.format.pandoc, ["gfm"])) {
      return "mermaid-source"; // sidestep github's in-band signaling of mermaid diagrams
    } else {
      return "default"; // no pandoc highlighting yet so we use 'default' to get grey shading
    }
  },

  defaultOptions: {
    echo: false,
    eval: true,
    include: true,
  },

  comment: "%%",

  async cell(
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    options: Record<string, unknown>,
  ) {
    // create puppeteer target page
    const dirName = handlerContext.options.temp.createDir();
    const content = `<html>
    <head>
    <script src="./mermaid.min.js"></script>
    </head>
    <body>
    <pre class="mermaid">\n${cell.source.value}\n</pre>
    <script>
    mermaid.initialize();
    </script>
    </html>`;
    const fileName = join(dirName, "index.html");
    Deno.writeTextFileSync(fileName, content);
    Deno.copyFileSync(
      formatResourcePath("html", join("mermaid", "mermaid.min.js")),
      join(dirName, "mermaid.min.js"),
    );
    const url = `file://${fileName}`;
    const selector = "pre.mermaid svg";

    if (isJavascriptCompatible(handlerContext.options.format)) {
      const svgText = (await extractHtmlFromElements(url, selector))[0];
      return this.build(handlerContext, cell, asMappedString(svgText), options);
    } else if (
      isMarkdownOutput(handlerContext.options.format.pandoc, ["gfm"])
    ) {
      return this.build(
        handlerContext,
        cell,
        mappedConcat(["\n``` mermaid\n", cell.source, "\n```\n"]),
        options,
      );
    } else {
      const pngName = `mermaid-figure-${++globalFigureCounter}.png`;
      const tempName = join(handlerContext.figuresDir(), pngName);
      await extractImagesFromElements(url, selector, [tempName]);
      return this.build(
        handlerContext,
        cell,
        mappedConcat([`\n![](${tempName})\n`]),
        options,
      );
    }
  },
};

install(mermaidHandler);
