import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import { asMappedString, mappedConcat } from "../lib/mapped-text.ts";

import { dirname, join } from "path/mod.ts";
import { encodeMetadata } from "../encode-metadata.ts";

const includeHandler: LanguageHandler = {
  ...baseHandler,

  languageName: "include",

  defaultOptions: {
    fixup: true,
  },

  type: "component",
  stage: "pre-engine",

  cell(
    handlerContext: LanguageCellHandlerContext,
    _cell: QuartoMdCell,
    options: Record<string, unknown>,
  ) {
    const fileName = options?.["file"];
    if (fileName === undefined) {
      throw new Error("Include directive needs attribute `file`");
    }

    const sourceDir = dirname(handlerContext.options.source);
    const includeName = join(sourceDir, fileName as string);

    const includeSrc = asMappedString(
      Deno.readTextFileSync(includeName),
      fileName as string,
    );

    const includeDirMetadata = encodeMetadata({
      directory: dirname(includeName),
    });
    const currentDirMetadata = encodeMetadata({
      clear_directory: true,
    });

    if (options?.fixup) {
      return mappedConcat([
        "\n",
        includeDirMetadata,
        includeSrc,
        includeSrc.value.endsWith("\n") ? "\n" : "\n\n",
        currentDirMetadata,
      ]);
    } else {
      return mappedConcat(["\n", includeSrc, "\n"]);
    }
  },
};

install(includeHandler);
