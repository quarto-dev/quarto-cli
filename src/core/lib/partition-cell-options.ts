/*
* partition-cell-options.ts
*
* Splits code cell into metadata+options
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { Range, rangedLines, RangedSubstring } from "./ranged-text.ts";
import { asMappedString, MappedString, mappedString } from "./mapped-text.ts";
/*import {
  langCommentChars,
  optionCommentPrefix,
  partitionCellOptionsMapped as libPartitionCellOptionsMapped,
} from "./partition-cell-options.ts";*/

import { getEngineOptionsSchema } from "./yaml-schema/chunk-metadata.ts";
import { guessChunkOptionsFormat } from "./guess-chunk-options-format.ts";
import { getYamlIntelligenceResource } from "./yaml-intelligence/resources.ts";
import { ConcreteSchema } from "./yaml-schema/types.ts";
import {
  readAndValidateYamlFromMappedString,
  ValidationError,
} from "./yaml-schema/validated-yaml.ts";
import { readAnnotatedYamlFromMappedString } from "./yaml-intelligence/annotated-yaml.ts";

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

export function partitionCellOptions(
  language: string,
  source: string[],
) {
  const commentChars = langCommentChars(language);
  const optionPattern = optionCommentPattern(commentChars[0]);
  const optionSuffix = commentChars[1] || "";

  // find the yaml lines
  const optionsSource: string[] = [];
  const yamlLines: string[] = [];
  for (const line of source) {
    const optionMatch = line.match(optionPattern);
    if (optionMatch) {
      if (!optionSuffix || line.trimEnd().endsWith(optionSuffix)) {
        let yamlOption = line.substring(optionMatch[0].length);
        if (optionSuffix) {
          yamlOption = yamlOption.trimEnd();
          yamlOption = yamlOption.substring(
            0,
            yamlOption.length - optionSuffix.length,
          );
          if (line.endsWith("\r\n")) {
            yamlOption += "\r\n";
          } else if (line.endsWith("\r") || line.endsWith("\n")) {
            yamlOption += line[line.length - 1];
          }
        }
        yamlLines.push(yamlOption);
        optionsSource.push(line);
        continue;
      }
    }
    break;
  }

  if (guessChunkOptionsFormat(yamlLines.join("\n")) === "knitr") {
    return {
      yaml: undefined,
      optionsSource,
      source: source.slice(yamlLines.length),
      sourceStartLine: yamlLines.length,
    };
  }

  let yaml;
  if (yamlLines.length > 0) {
    yaml = readAnnotatedYamlFromMappedString(
      asMappedString(yamlLines.join("\n")),
    )!.result;
  }

  return {
    yaml: yaml as Record<string, unknown> | undefined,
    optionsSource,
    source: source.slice(yamlLines.length),
    sourceStartLine: yamlLines.length,
  };
}

export async function parseAndValidateCellOptions(
  mappedYaml: MappedString,
  language: string,
  validate = false,
  engine = "",
  lenient = false,
) {
  if (mappedYaml.value.trim().length === 0) {
    return undefined;
  }

  const engineOptionsSchema = await getEngineOptionsSchema();
  let schema: ConcreteSchema | undefined = engineOptionsSchema[engine];

  const languages = getYamlIntelligenceResource(
    "handlers/languages.yml",
  ) as string[];

  if (languages.indexOf(language) !== -1) {
    try {
      schema = getYamlIntelligenceResource(
        `handlers/${language}/schema.yml`,
      ) as ConcreteSchema;
    } catch (_e) {
      schema = undefined;
    }
  }

  if (schema === undefined || !validate) {
    return readAnnotatedYamlFromMappedString(mappedYaml, lenient)!.result;
  }

  const { yaml, yamlValidationErrors } =
    await readAndValidateYamlFromMappedString(
      mappedYaml,
      schema,
      undefined,
      lenient,
    );

  if (yamlValidationErrors.length > 0) {
    throw new ValidationError(
      `Validation of YAML metadata for cell with engine ${engine} failed`,
      yamlValidationErrors,
    );
  }
  return yaml;
}

/** partitionCellOptionsText splits the a cell code source
 * into:
 * {
 *   yaml: MappedString; // mapped text containing the yaml metadata, without the "//|"" comments
 *   optionsSource: RangedSubstring[]; // the source code of the yaml metadata, including comments
 *   source: MappedString; // the executable source code of the cell itself
 *   sourceStartLine: number; // the index of the line number where the source code of the cell starts
 * }
 */
export function partitionCellOptionsText(
  language: string,
  source: MappedString,
) {
  const commentChars = langCommentChars(language);
  const optionPattern = optionCommentPattern(commentChars[0]);
  const optionSuffix = commentChars[1] || "";

  // find the yaml lines
  const optionsSource: RangedSubstring[] = []; // includes comments
  const yamlLines: RangedSubstring[] = []; // strips comments

  let endOfYaml = 0;
  for (const line of rangedLines(source.value, true)) {
    const optionMatch = line.substring.match(optionPattern);
    if (optionMatch) {
      if (!optionSuffix || line.substring.trimEnd().endsWith(optionSuffix)) {
        let yamlOption = line.substring.substring(optionMatch[0].length);
        if (optionSuffix) {
          yamlOption = yamlOption.trimEnd();
          yamlOption = yamlOption.substring(
            0,
            yamlOption.length - optionSuffix.length,
          ).trimEnd();
        }
        endOfYaml = line.range.start + optionMatch[0].length +
          yamlOption.length;
        const rangedYamlOption = {
          substring: yamlOption,
          range: {
            start: line.range.start + optionMatch[0].length,
            end: endOfYaml,
          },
        };
        yamlLines.push(rangedYamlOption);

        if (optionSuffix) {
          if (line.substring.endsWith("\r\n")) {
            // add range for the \r\n
            yamlLines.push({
              substring: "\r\n",
              range: {
                start: line.range.end - 2,
                end: line.range.end,
              },
            });
          } else if (
            line.substring.endsWith("\r") ||
            line.substring.endsWith("\n")
          ) {
            // add range for the \r or \n
            yamlLines.push({
              substring: line.substring[line.substring.length - 1],
              range: {
                start: line.range.end - 1,
                end: line.range.end,
              },
            });
          }
        }

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

/** NB: this version _does_ parse and validate the YAML source!
 */
export async function partitionCellOptionsMapped(
  language: string,
  outerSource: MappedString,
  validate = false,
  engine = "",
  lenient = false,
) {
  const {
    yaml: mappedYaml,
    optionsSource,
    source,
    sourceStartLine,
  } = partitionCellOptionsText(language, outerSource);

  if (
    language !== "r" || // only skip validation when language === 'r' and guessChunkOptionsFormat == "knitr"
    guessChunkOptionsFormat((mappedYaml || asMappedString("")).value) === "yaml"
  ) {
    const yaml = await parseAndValidateCellOptions(
      mappedYaml || asMappedString(""),
      language,
      validate,
      engine,
      lenient,
    );

    return {
      yaml: yaml as Record<string, unknown> | undefined,
      optionsSource,
      source,
      sourceStartLine,
    };
  } else {
    return {
      yaml: undefined,
      optionsSource,
      source,
      sourceStartLine,
    };
  }
}

export function langCommentChars(lang: string): string[] {
  const chars = kLangCommentChars[lang] || "#";
  if (!Array.isArray(chars)) {
    return [chars];
  } else {
    return chars;
  }
}
export function optionCommentPattern(comment: string) {
  return new RegExp("^" + escapeRegExp(comment) + "\\s*\\| ?");
}

// FIXME this is an awkward spot for this particular entry point
export function addLanguageComment(
  language: string,
  comment: string | [string, string],
) {
  kLangCommentChars[language] = comment;
}

export function optionCommentPatternFromLanguage(language: string) {
  return optionCommentPattern(langCommentChars(language)[0]);
}

export const kLangCommentChars: Record<string, string | [string, string]> = {
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
  prql: "#",
  ruby: "#",
  tikz: "%",
  js: "//",
  d3: "//",
  node: "//",
  sass: "//",
  scss: "//",
  coffee: "#",
  go: "//",
  asy: "//",
  haskell: "--",
  dot: "//",
  ojs: "//",
  apl: "⍝",
  ocaml: ["(*", "*)"],
};

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
