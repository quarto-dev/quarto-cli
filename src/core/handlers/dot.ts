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
  isRevealjsOutput,
} from "../../config/format.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import { mappedConcat, mappedIndexToRowCol } from "../lib/mapped-text.ts";

import { lineOffsets } from "../lib/text.ts";
import {
  kFigAlign,
  kFigHeight,
  kFigResponsive,
  kFigWidth,
} from "../../config/constants.ts";
import {
  fixupAlignment,
  makeResponsive,
  resolveSize,
  setSvgSize,
} from "../svg.ts";
import { Element, parseHtml } from "../deno-dom.ts";

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

    const fixupRevealAlignment = (svg: Element) => {
      if (isRevealjsOutput(handlerContext.options.context.format.pandoc)) {
        const align = (options?.[kFigAlign] as string) ?? "center";
        fixupAlignment(svg, align);
      }
    };

    if (isJavascriptCompatible(handlerContext.options.format)) {
      const responsive = options?.[kFigResponsive] ??
        handlerContext.options.context.format.metadata
          ?.[kFigResponsive];

      svg = (await parseHtml(svg)).querySelector("svg")!.outerHTML;
      if (
        responsive && options[kFigWidth] === undefined &&
        options[kFigHeight] === undefined
      ) {
        svg = await makeResponsive(svg, fixupRevealAlignment);
      } else {
        svg = await setSvgSize(svg, options, fixupRevealAlignment);
      }

      return this.build(handlerContext, cell, svg, options);
    } else {
      const {
        filenames: [sourceName],
      } = await handlerContext.createPngsFromHtml({
        prefix: "dot-figure-",
        selector: "svg",
        count: 1,
        deviceScaleFactor: Number(options.deviceScaleFactor) || 4,
        html: `<!DOCTYPE html><html><body>${svg}</body></html>`,
      });

      const {
        widthInInches,
        heightInInches,
      } = await resolveSize(svg, options);

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
