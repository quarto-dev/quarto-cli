/*
* page-break.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { DirectiveCell } from "../lib/break-quarto-md-types.ts";

const includeHandler: LanguageHandler = {
  ...baseHandler,

  languageName: "pagebreak",
  type: "directive",
  stage: "pre-engine",

  directive(
    _handlerContext: LanguageCellHandlerContext,
    _directive: DirectiveCell,
  ) {
    return "\n\n\\pagebreak\n\n";
  },
};

install(includeHandler);
