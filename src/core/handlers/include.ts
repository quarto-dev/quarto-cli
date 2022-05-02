/*
* include.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install } from "./base.ts";
import {
  asMappedString,
  EitherString,
  mappedConcat,
  MappedString,
  mappedString,
} from "../lib/mapped-text.ts";

import { dirname, join, normalize, relative } from "path/mod.ts";
import { encodeMetadata } from "../encode-metadata.ts";
import { rangedLines } from "../lib/ranged-text.ts";
import {
  getShortcodeNamedParams,
  getShortcodeUnnamedParams,
  isBlockShortcode,
} from "../lib/parse-shortcode.ts";
import { DirectiveCell } from "../lib/break-quarto-md-types.ts";

const includeHandler: LanguageHandler = {
  ...baseHandler,

  languageName: "include",

  type: "directive",
  stage: "pre-engine",

  directive(
    handlerContext: LanguageCellHandlerContext,
    directive: DirectiveCell,
  ): Promise<MappedString> {
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
        const m = isBlockShortcode(substring);
        if (m && m.name.toLocaleLowerCase() === "include") {
          textFragments.push(
            mappedString(includeSrc, [{ start: rangeStart, end: range.start }]),
          );
          rangeStart = range.end;
          const params = getShortcodeUnnamedParams(m);
          const options = getShortcodeNamedParams(m);
          if (params.length === 0) {
            throw new Error("Include directive needs file parameter");
          }
          const file = params[0];
          const fixup = options.fixup === undefined
            ? undefined
            : (options.fixup.toLocaleLowerCase() !== "false");

          retrieveInclude(
            join(...[...retrievedDirectories, file]),
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

    const params = getShortcodeUnnamedParams(directive);
    const options = getShortcodeNamedParams(directive);
    if (params.length === 0) {
      throw new Error("Include directive needs filename as a parameter");
    }
    const includeName = join(sourceDir, params[0]);

    const fixup = options.fixup === undefined
      ? undefined
      : (options.fixup.toLocaleLowerCase() !== "false");

    retrieveInclude(includeName, fixup);

    return Promise.resolve(mappedConcat(textFragments));
  },
};

install(includeHandler);
