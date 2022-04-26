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
import { isDirectiveTag } from "../lib/parse-directive-tag.ts";

const includeHandler: LanguageHandler = {
  ...baseHandler,

  languageName: "include",

  type: "directive",
  stage: "pre-engine",

  cell(
    handlerContext: LanguageCellHandlerContext,
    _cell: QuartoMdCell,
    options: Record<string, unknown>,
  ) {
    const sourceDir = dirname(handlerContext.options.source);
    const retrievedFiles: string[] = [handlerContext.options.source];
    const retrievedDirectories: string[] = [sourceDir];
    const fixups: (boolean | undefined)[] = [];

    const textFragments: EitherString[] = [];

    const needsFixup = () => {
      for (let i = fixups.length - 1; i >= 0; --i) {
        if (fixups[i] !== undefined) {
          return fixups[i];
        }
      }
      return true;
    };

    const addFixup = (filename: string) => {
      if (fixups.length > 0 && needsFixup()) {
        let includeDir = relative(sourceDir, dirname(filename));
        if (includeDir === "") {
          includeDir = ".";
        }
        textFragments.push(encodeMetadata({
          include_directory: includeDir,
        }));
      } else {
        textFragments.push(encodeMetadata({
          clear_include_directory: true,
        }));
      }
    };

    const retrieveInclude = (filename: string, fixup: boolean | undefined) => {
      const norm = relative(
        join(...retrievedDirectories),
        normalize(filename),
      );
      if (retrievedFiles.indexOf(filename) !== -1) {
        throw new Error(
          `Include directive found circular include of file ${filename}.`,
        );
      }

      let includeSrc;
      try {
        includeSrc = asMappedString(
          Deno.readTextFileSync(filename),
          filename,
        );
      } catch (_e) {
        const errMsg: string[] = [`Include directive failed.`];
        errMsg.push(...retrievedFiles.map((s) => `  in file ${s}, `));
        errMsg.push(`  could not find file ${norm}.`);
        throw new Error(errMsg.join("\n"));
      }

      retrievedFiles.push(filename);
      retrievedDirectories.push(dirname(norm));
      fixups.push(fixup);
      addFixup(filename);

      let rangeStart = 0;
      for (const { substring, range } of rangedLines(includeSrc.value)) {
        const m = isDirectiveTag(substring);
        if (
          m && m.which === "emptyDirective" &&
          m.name.toLocaleLowerCase() === "include"
        ) {
          textFragments.push(
            mappedString(includeSrc, [{ start: rangeStart, end: range.start }]),
          );
          rangeStart = range.end;
          if (typeof m.attributes.file !== "string") {
            throw new Error("Include directive needs attribute `file`");
          }
          const fixup = m.attributes.fixup === undefined
            ? undefined
            : ((m.attributes.fixup as string).toLocaleLowerCase() !== "false");
          retrieveInclude(
            join(...[...retrievedDirectories, m.attributes.file]),
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
      addFixup(filename);
    };

    const fileName = options?.["file"];
    if (fileName === undefined) {
      throw new Error("Include directive needs attribute `file`");
    }

    const includeName = join(sourceDir, fileName as string);

    const fixup = options.fixup === undefined
      ? undefined
      : ((typeof options.fixup === "string") &&
        (options.fixup.toLocaleLowerCase() !== "false"));

    retrieveInclude(includeName, fixup);

    return mappedConcat(textFragments);
  },
};

install(includeHandler);
