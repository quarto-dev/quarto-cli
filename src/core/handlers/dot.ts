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
import { isJavascriptCompatible } from "../../config/format.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import { mappedConcat, mappedIndexToRowCol } from "../lib/mapped-text.ts";

import { extractImagesFromElements } from "../puppeteer.ts";
import { lineOffsets } from "../lib/text.ts";

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
    const cellContent = handlerContext.cellContent(cell);
    const graphvizModule = await import(
      resourcePath(join("js", "graphviz-wasm.js"))
    );
    let svg;
    try {
      svg = await graphvizModule.graphviz().layout(
        cellContent.value,
        "svg",
        options["graph-layout"],
      );
    } catch (e) {
      const m = (e.message as string).match(
        /(.*)syntax error in line (\d+)(.*)/,
      );
      if (m) {
        const number = Number(m[2]) - 1;
        const locF = mappedIndexToRowCol(cellContent);
        const offsets = Array.from(lineOffsets(cellContent.value));
        const offset = offsets[number];
        const mapResult = cellContent.map(offset, true);
        const { line } = locF(offset);
        e.message = (e.message as string).replace(
          m[0],
          `${m[1]}syntax error in file ${
            mapResult!.originalString.fileName
          }, line ${line + 1}${m[3]}`,
        );
        throw e;
      } else {
        throw e;
      }
    }

    if (isJavascriptCompatible(handlerContext.options.format)) {
      return this.build(
        handlerContext,
        cell,
        mappedConcat(["```{=html}\n", svg, "```"]),
        options,
      );
    } else {
      const dims = svg.split("\n").filter((a: string) =>
        a.indexOf("<svg") !== -1
      );
      if (dims.length === 0) {
        throw new Error("Internal error: couldn't find figure dimensions");
      }
      const m1 = dims[0].match(/^.*width="(\d+)pt".*$/);
      const m2 = dims[0].match(/^.*height="(\d+)pt".*$/);
      if (!(m1 && m2)) {
        throw new Error("Internal error: couldn't find figure dimensions");
      }
      const widthInInches = Number(m1[1]) / 96; // https://graphviz.org/docs/attrs/dpi/
      const heightInInches = Number(m2[1]) / 96;

      // create puppeteer target page
      const dirName = handlerContext.options.temp.createDir();
      const content = `<!DOCTYPE html><html><body>${svg}</body></html>`;
      const fileName = join(dirName, "index.html");
      Deno.writeTextFileSync(fileName, content);
      const url = `file://${fileName}`;
      const selector = "svg";

      const { sourceName, fullName: tempName } = handlerContext
        .uniqueFigureName("dot-figure-", ".png");
      await extractImagesFromElements(
        {
          url,
          viewport: {
            width: 800,
            height: 600,
            deviceScaleFactor: Number(options.deviceScaleFactor) || 4,
          },
        },
        selector,
        [tempName],
      );
      return this.build(
        handlerContext,
        cell,
        mappedConcat([
          `\n![](${sourceName}){width="${widthInInches}in" height="${heightInInches}in" fig-pos='H'}\n`,
        ]),
        options,
      );
    }
  },
};

install(dotHandler);
