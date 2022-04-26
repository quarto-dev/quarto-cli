/*
* keep-if.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import {
  isDocxOutput,
  isHtmlCompatible,
  isJavascriptCompatible,
  isMarkdownOutput,
  isPdfOutput,
} from "../../config/format.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import { asMappedString, mappedConcat } from "../lib/mapped-text.ts";

const keepIfHandler: LanguageHandler = {
  ...baseHandler,

  type: "directive",
  stage: "post-engine",

  languageName: "keep-if",

  defaultOptions: {},

  cell(
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
  ) {
    // FIXME there's probably a more elegant way to do this...

    const formatCheckers = [
      {
        name: "html",
        checker: isHtmlCompatible(handlerContext.options.format),
      },
      {
        name: "pdf",
        checker: isPdfOutput(handlerContext.options.format.pandoc),
      },
      {
        name: "javascript",
        checker: isJavascriptCompatible(handlerContext.options.format),
      },
      {
        name: "markdown",
        checker: isMarkdownOutput(handlerContext.options.format.pandoc),
      },
      {
        name: "docx",
        checker: isDocxOutput(handlerContext.options.format.pandoc),
      },
    ];
    if (
      formatCheckers.every(({ name, checker }) =>
        // a -> b === !a || b
        cell.options?.[name] === undefined || checker
      )
    ) {
      return mappedConcat([cell.source, asMappedString("\n")]);
    } else {
      return asMappedString("\n");
    }
  },
};

install(keepIfHandler);
