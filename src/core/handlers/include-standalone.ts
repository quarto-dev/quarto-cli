/*
 * include-standalone.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { LanguageCellHandlerContext } from "./types.ts";

import {
  asMappedString,
  EitherString,
  mappedConcat,
  MappedString,
  mappedString,
} from "../lib/mapped-text.ts";

import { rangedLines } from "../lib/ranged-text.ts";
import { isBlockShortcode } from "../lib/parse-shortcode.ts";

export const standaloneInclude = async (
  handlerContext: LanguageCellHandlerContext,
  filename: string,
): Promise<MappedString> => {
  const source = handlerContext.options.context.target.source;
  const retrievedFiles: string[] = [source];

  const textFragments: EitherString[] = [];
  if (!handlerContext.options.state) {
    handlerContext.options.state = {};
  }
  if (!handlerContext.options.state.include) {
    handlerContext.options.state.include = {};
  }
  const includeState: Record<string, string> = handlerContext.options.state
    .include as Record<string, string>;

  const retrieveInclude = async (filename: string) => {
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
          mappedString(includeSrc, [{
            start: rangeStart,
            end: range.start,
          }]),
        );
        rangeStart = range.end;
        const params = m.params;
        if (params.length === 0) {
          throw new Error("Include directive needs file parameter");
        }

        includeState[filename] = path;
        await retrieveInclude(params[0]);
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

  await retrieveInclude(filename);

  return Promise.resolve(mappedConcat(textFragments));
};
