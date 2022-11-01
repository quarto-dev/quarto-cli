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
import { jupyterAssets } from "../jupyter/jupyter.ts";

import { notebookMarkdown, parseNotebookPath } from "./include-notebook.ts";
import { JupyterCell } from "../jupyter/types.ts";

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
    async handle(filename: string, handlerContext: LanguageCellHandlerContext) {
      const markdownFragments: EitherString[] = [];

      // Resolve the filename into a path
      const path = handlerContext.resolvePath(filename);

      const notebookAddress = parseNotebookPath(path);
      if (notebookAddress) {
        const assets = jupyterAssets(
          handlerContext.options.context.target.source,
          handlerContext.options.context.format.pandoc.to,
        );

        // Render the notebook markdown and inject it
        const markdown = await notebookMarkdown(
          notebookAddress,
          assets,
          handlerContext.options.context,
          handlerContext.options.flags,
          (cell: JupyterCell) => {
            cell.metadata["echo"] = false;
            cell.metadata["warning"] = false;
            cell.metadata["output"] = "asis";
            return cell;
          },
        );
        if (markdown) {
          markdownFragments.push(markdown);
        }
        return {
          handled: true,
          markdownFragments,
        };
      } else {
        return {
          handled: false,
          markdownFragments: [],
        };
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
