/*
* double.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import { mappedConcat } from "../lib/mapped-text.ts";

const doubleHandler: LanguageHandler = {
  ...baseHandler,

  type: "directive",
  stage: "post-engine",

  languageName: "double",

  defaultOptions: {
    echo: false,
    eval: true,
    "code-fold": false,
    include: true,
  },

  cell(
    _handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
  ) {
    return mappedConcat([cell.source, "\n", cell.source]);
  },
};

install(doubleHandler);
