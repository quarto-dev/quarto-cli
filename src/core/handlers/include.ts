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

import { relative } from "path/mod.ts";
import { rangedLines } from "../lib/ranged-text.ts";
import { isBlockShortcode } from "../lib/parse-shortcode.ts";
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
    const source = handlerContext.options.context.target.source;
    const retrievedFiles: string[] = [source];

    const textFragments: EitherString[] = [];

    const retrieveInclude = (filename: string) => {
      const path = handlerContext.resolvePath(filename);

      if (retrievedFiles.indexOf(path) !== -1) {
        throw new Error(
          `Include directive found circular include of file ${filename}.`,
        );
      }

      let includeSrc;
      try {
        includeSrc = asMappedString(
          Deno.readTextFileSync(path),
          path,
        );
      } catch (_e) {
        const errMsg: string[] = [`Include directive failed.`];
        errMsg.push(...retrievedFiles.map((s) => `  in file ${s}, `));
        errMsg.push(
          `  could not find file ${path
            //            relative(handlerContext.options.context.target.source, path)
          }.`,
        );
        throw new Error(errMsg.join("\n"));
      }

      retrievedFiles.push(filename);

      let rangeStart = 0;
      for (const { substring, range } of rangedLines(includeSrc.value)) {
        const m = isBlockShortcode(substring);
        if (m && m.name.toLocaleLowerCase() === "include") {
          textFragments.push(
            mappedString(includeSrc, [{ start: rangeStart, end: range.start }]),
          );
          rangeStart = range.end;
          const params = m.params;
          if (params.length === 0) {
            throw new Error("Include directive needs file parameter");
          }

          retrieveInclude(params[0]);
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
    };

    const param = directive.shortcode.params[0];
    if (!param) {
      throw new Error("Include directive needs filename as a parameter");
    }

    retrieveInclude(param);

    return Promise.resolve(mappedConcat(textFragments));
  },
};

install(includeHandler);
