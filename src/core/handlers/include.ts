import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import {
  isJavascriptCompatible,
  isMarkdownOutput,
} from "../../config/format.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import { asMappedString, mappedConcat } from "../lib/mapped-text.ts";

import { pandocHtmlBlock, pandocRawStr } from "../pandoc/codegen.ts";

import { dirname, join } from "path/mod.ts";

const includeHandler: LanguageHandler = {
  ...baseHandler,

  languageName: "include",

  type: "component",
  stage: "pre-engine",

  cell(
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
  ) {
    const fileName = cell.options?.["file"];
    if (fileName === undefined) {
      return cell.sourceVerbatim;
    }

    const includeSrc = asMappedString(
      Deno.readTextFileSync(
        join(dirname(handlerContext.options.source), fileName as string),
      ),
      fileName as string,
    );

    const includeDirMetadata = asMappedString("");
    const currentDirMetadata = asMappedString("");

    if (cell.options.fixup) {
      return mappedConcat([includeDirMetadata, includeSrc, currentDirMetadata]);
    } else {
      return includeSrc;
    }
  },
};

install(includeHandler);
