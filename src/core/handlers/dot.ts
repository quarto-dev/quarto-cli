/*
* graphviz.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { resourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import {
  isJavascriptCompatible,
  isMarkdownOutput,
} from "../../config/format.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import { mappedConcat } from "../lib/mapped-text.ts";

import { extractImagesFromElements } from "../puppeteer.ts";

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
    "graph-layout": "dot",
  },

  comment: "//",

  async cell(
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    options: Record<string, unknown>,
  ) {
    const graphvizModule = await import(
      resourcePath(join("js", "graphviz-wasm.js"))
    );
    const svg = await graphvizModule.graphviz().layout(
      cell.source.value,
      "svg",
      options["graph-layout"],
    );

    if (isJavascriptCompatible(handlerContext.options.format)) {
      return this.build(
        handlerContext,
        cell,
        mappedConcat(["```{=html}\n", svg, "```"]),
        options,
      );
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
      // create puppeteer target page
      const dirName = handlerContext.options.temp.createDir();
      const content = `<!DOCTYPE html><html><body>${svg}</body></html>`;
      const fileName = join(dirName, "index.html");
      Deno.writeTextFileSync(fileName, content);
      const url = `file://${fileName}`;
      const selector = "svg";

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
