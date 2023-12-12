/*
 * include.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { MappedString } from "../lib/mapped-text.ts";

import { DirectiveCell } from "../lib/break-quarto-md-types.ts";
import { standaloneInclude } from "./include-standalone.ts";

const includeHandler: LanguageHandler = {
  ...baseHandler,

  languageName: "include",

  type: "directive",
  stage: "pre-engine",

  async directive(
    handlerContext: LanguageCellHandlerContext,
    directive: DirectiveCell,
  ): Promise<MappedString> {
    const param = directive.shortcode.params[0];
    if (!param) {
      throw new Error("Include directive needs filename as a parameter");
    }
    return await standaloneInclude(handlerContext, param);
  },
};

install(includeHandler);
