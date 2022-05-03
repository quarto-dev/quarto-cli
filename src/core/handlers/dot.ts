/*
* graphviz.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
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

const dotHandler: LanguageHandler = {
  ...baseHandler,

  type: "cell",
  stage: "post-engine",

  languageName: "dot",

  defaultOptions: {
    echo: false,
    eval: true,
    include: true,
  },

  comment: "//",

  async cell(
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    options: Record<string, unknown>,
  ) {
    // create puppeteer target page
    const dirName = handlerContext.options.temp.createDir();
    const content = `<!DOCTYPE html>
    <html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en"><head>
    
    <meta charset="utf-8">
    <meta name="generator" content="quarto-99.9.9">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    <script type="module" src="esbuild-bundle.js"></script>
    </head>
    <body class="fullcontent">
    <div id="quarto-content" class="page-columns page-rows-contents page-layout-article">
    <main class="content" id="quarto-document-content">
    <div class="cell">
    <div class="sourceCode cell-code hidden"></div>
    <div class="cell-output cell-output-display"><div id="ojs-cell-1" data-nodetype="expression">
    </div></div></div>
    
    </main>
    
    <script type="ojs-module-contents">
    {"contents":[{"methodName":"interpret","cellName":"ojs-cell-1","inline":false,"source":${
      JSON.stringify("dot`\n" + cell.source.value + "\n`")
    }}]}
    </script>
    <script type="module">
    window._ojs.paths.runtimeToDoc = "../../..";
    window._ojs.paths.runtimeToRoot = "../../..";
    window._ojs.paths.docToRoot = "";
    window._ojs.selfContained = false;
    window._ojs.runtime.interpretFromScriptTags();
    </script>
    </div>
    </body></html>`;
    const fileName = join(dirName, "index.html");
    console.log(fileName);
    Deno.writeTextFileSync(fileName, content);
    Deno.copyFileSync(
      formatResourcePath("html", join("ojs", "esbuild-bundle.js")),
      join(dirName, "esbuild-bundle.js"),
    );
    const url = `file://${fileName}`;
    const selector = "svg";

    if (isJavascriptCompatible(handlerContext.options.format)) {
      const svgText =
        (await extractHtmlFromElements(url, selector, { wait: 50000 }))[0];
      return this.build(handlerContext, cell, asMappedString(svgText), options);
    } else if (
      isMarkdownOutput(handlerContext.options.format.pandoc, ["gfm"])
    ) {
      return this.build(
        handlerContext,
        cell,
        mappedConcat(["\n``` dot\n", cell.source, "\n```\n"]),
        options,
      );
    } else {
      const pngName = `dot-figure-${++globalFigureCounter}.png`;
      const tempName = join(dirName, pngName);
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

install(dotHandler);
