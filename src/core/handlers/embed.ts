/*
* embed.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import {
  EitherString,
  mappedConcat,
  MappedString,
} from "../lib/mapped-text.ts";

import { DirectiveCell } from "../lib/break-quarto-md-types.ts";

import {
  notebookMarkdownPlaceholder,
  parseNotebookPath,
} from "./include-notebook.ts";

interface EmbedHandler {
  name: string;
  handle(
    filename: string,
    handlerContext: LanguageCellHandlerContext,
  ): Promise<{
    handled: boolean;
    markdownFragments: EitherString[];
  }>;
}

const kHandlers: EmbedHandler[] = [
  {
    name: "Jupyter Notebook Embed",
    handle(filename: string, handlerContext: LanguageCellHandlerContext) {
      const markdownFragments: EitherString[] = [];

      // Resolve the filename into a path
      const path = handlerContext.resolvePath(filename);

      const notebookAddress = parseNotebookPath(path);
      if (notebookAddress) {
        const placeHolder = notebookMarkdownPlaceholder(path, {
          echo: false,
          warning: false,
          asis: true,
        });

        markdownFragments.push(placeHolder);
        return Promise.resolve({
          handled: true,
          markdownFragments,
        });
      } else {
        return Promise.resolve({
          handled: false,
          markdownFragments: [],
        });
      }
    },
  },
];

const embedHandler: LanguageHandler = {
  ...baseHandler,

  languageName: "embed",

  type: "directive",
  stage: "pre-engine",

  async directive(
    handlerContext: LanguageCellHandlerContext,
    directive: DirectiveCell,
  ): Promise<MappedString> {
    const textFragments: EitherString[] = [];

    // The first parameter is a path to a file
    const filename = directive.shortcode.params[0];
    if (!filename) {
      throw new Error("Embed directive needs filename as a parameter");
    }

    // Go through handlers until one handles the embed by returning markdown
    for (const handler of kHandlers) {
      const result = await handler.handle(filename, handlerContext);
      if (result.handled) {
        textFragments.push(...result.markdownFragments);
        break;
      }
    }

    // Return the markdown
    return mappedConcat(textFragments);
  },
};

install(embedHandler);
