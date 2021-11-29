/*
* partition-cell-options.ts
*
* Splits code cell into metadata+options
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Range, rangedLines, RangedSubstring } from "./ranged-text.ts";
import { MappedString, mappedString } from "./mapped-text.ts";

function mappedSource(
  source: MappedString | string,
  substrs: RangedSubstring[],
) {
  const params: (Range | string)[] = [];
  for (const { range } of substrs) {
    params.push(range);
  }
  return mappedString(source, params);
}

/** NB: this version does not validate or parse the YAML source
 *
 * also, it's async to match the core version type, although the async bit is only required inthe core versio
 */
// deno-lint-ignore require-await
export async function partitionCellOptionsMapped(
  language: string,
  source: MappedString,
  _validate = false,
) {
  const commentChars = langCommentChars(language);
  const optionPrefix = optionCommentPrefix(commentChars[0]);
  const optionSuffix = commentChars[1] || "";

  // find the yaml lines
  const optionsSource: RangedSubstring[] = []; // includes comments
  const yamlLines: RangedSubstring[] = []; // strips comments

  let endOfYaml = 0;
  for (const line of rangedLines(source.value, true)) {
    if (line.substring.startsWith(optionPrefix)) {
      if (!optionSuffix || line.substring.trimRight().endsWith(optionSuffix)) {
        let yamlOption = line.substring.substring(optionPrefix.length);
        if (optionSuffix) {
          yamlOption = yamlOption.trimRight();
          yamlOption = yamlOption.substring(
            0,
            yamlOption.length - optionSuffix.length,
          );
        }
        endOfYaml = line.range.start + optionPrefix.length + yamlOption.length -
          optionSuffix.length;
        const rangedYamlOption = {
          substring: yamlOption,
          range: {
            start: line.range.start + optionPrefix.length,
            end: endOfYaml,
          },
        };
        yamlLines.push(rangedYamlOption);
        optionsSource.push(line);
        continue;
      }
    }
    break;
  }

  const mappedYaml = yamlLines.length
    ? mappedSource(source, yamlLines)
    : undefined;

  return {
    // yaml: yaml as Record<string, unknown> | undefined,
    // yamlValidationErrors,
    yaml: mappedYaml,
    optionsSource,
    source: mappedString(source, [{
      start: endOfYaml,
      end: source.value.length,
    }]), // .slice(yamlLines.length),
    sourceStartLine: yamlLines.length,
  };
}

export function langCommentChars(lang: string): string[] {
  const chars = kLangCommentChars[lang] || "#";
  if (!Array.isArray(chars)) {
    return [chars];
  } else {
    return chars;
  }
}
export function optionCommentPrefix(comment: string) {
  return comment + "| ";
}

export const kLangCommentChars: Record<string, string | string[]> = {
  r: "#",
  python: "#",
  julia: "#",
  scala: "//",
  matlab: "%",
  csharp: "//",
  fsharp: "//",
  c: ["/*", "*/"],
  css: ["/*", "*/"],
  sas: ["*", ";"],
  powershell: "#",
  bash: "#",
  sql: "--",
  mysql: "--",
  psql: "--",
  lua: "--",
  cpp: "//",
  cc: "//",
  stan: "#",
  octave: "#",
  fortran: "!",
  fortran95: "!",
  awk: "#",
  gawk: "#",
  stata: "*",
  java: "//",
  groovy: "//",
  sed: "#",
  perl: "#",
  ruby: "#",
  tikz: "%",
  js: "//",
  d3: "//",
  node: "//",
  sass: "//",
  coffee: "#",
  go: "//",
  asy: "//",
  haskell: "--",
  dot: "//",
  ojs: "//",
};
