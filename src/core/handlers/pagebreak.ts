/*
* page-break.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";

const includeHandler: LanguageHandler = {
  ...baseHandler,

  languageName: "pagebreak",
  type: "directive",
  stage: "pre-engine",

  directive(
    _handlerContext: LanguageCellHandlerContext,
    _options: Record<string, string>,
  ) {
    return "\n\n\\pagebreak\n\n";
  },
};

install(includeHandler);
