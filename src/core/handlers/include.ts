import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import {
  asMappedString,
  EitherString,
  mappedConcat,
  mappedString,
} from "../lib/mapped-text.ts";

import { dirname, join, normalize, relative } from "path/mod.ts";
import { encodeMetadata } from "../encode-metadata.ts";
import { rangedLines } from "../lib/ranged-text.ts";
import { isComponentTag } from "../lib/parse-component-tag.ts";

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
    const sourceDir = dirname(handlerContext.options.source);
    const retrievedFiles: string[] = [];
    const retrievedDirectories: string[] = [];
    const fixups: boolean[] = [];

    const textFragments: EitherString[] = [];

    const retrieveInclude = (filename: string, fixup: boolean) => {
      const norm = relative(sourceDir, normalize(filename));
      if (retrievedFiles.indexOf(norm) !== -1) {
        throw new Error(
          `Include directive found circular include of file ${norm}.`,
        );
      }
      retrievedFiles.push(norm);
      retrievedDirectories.push(dirname(norm));
      fixups.push(fixup);
      const includeSrc = asMappedString(
        Deno.readTextFileSync(filename),
        filename,
      );
      if (fixup) {
        textFragments.push(encodeMetadata({
          include_directory: dirname(norm),
        }));
      } else {
        textFragments.push(encodeMetadata({
          clear_include_directory: true,
        }));
      }

      let rangeStart = 0;
      for (const { substring, range } of rangedLines(includeSrc.value)) {
        const m = isComponentTag(substring);
        if (
          m && m.which === "emptyComponent" &&
          m.name.toLocaleLowerCase() === "include"
        ) {
          textFragments.push(
            mappedString(includeSrc, [{ start: rangeStart, end: range.start }]),
          );
          rangeStart = range.end;
          if (typeof m.attributes.file !== "string") {
            throw new Error("Include directive needs attribute `file`");
          }
          const fixup = (m.attributes.fixup === undefined) ||
            ((m.attributes.fixup as string).toLocaleLowerCase() !== "false");
          retrieveInclude(
            join(
              retrievedDirectories[retrievedDirectories.length - 1],
              m.attributes.file,
            ),
            fixup,
          );
        }
      }
      if (rangeStart !== includeSrc.value.length) {
        textFragments.push(
          mappedString(includeSrc, [{
            start: rangeStart,
            end: includeSrc.value.length,
          }]),
        );
      }
      textFragments.push(includeSrc.value.endsWith("\n") ? "\n" : "\n\n");

      retrievedFiles.pop();
      retrievedDirectories.pop();
      fixups.pop();

      if (fixups.length === 0 || fixups[fixups.length - 1] === false) {
        textFragments.push(encodeMetadata({
          clear_include_directory: true,
        }));
      } else {
        // assert(retrievedDirectories.length > 0 && fixups[fixups.length - 1] === true)
        textFragments.push(encodeMetadata({
          include_directory:
            retrievedDirectories[retrievedDirectories.length - 1],
        }));
      }
    };

    const fileName = options?.["file"];
    if (fileName === undefined) {
      throw new Error("Include directive needs attribute `file`");
    }

    const includeName = join(sourceDir, fileName as string);

    const fixup = (options?.fixup === true) ||
      ((typeof options.fixup === "string") &&
        options.fixup.toLocaleLowerCase() !== "false");

    retrieveInclude(includeName, fixup);

    return mappedConcat(textFragments);
  },
};

install(includeHandler);
