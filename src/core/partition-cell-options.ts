/*
* partition-cell-options.ts
*
* Splits code cell into metadata+options
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { readYamlFromString } from "./yaml.ts";
import { readAnnotatedYamlFromMappedString } from "./schema/annotated-yaml.ts";
import { warnOnce } from "./log.ts";
import { rangedLines, rangedSubstring, RangedSubstring, Range } from "./ranged-text.ts";
import { mappedString, MappedString } from "./mapped-text.ts";

import { LocalizedError } from "./schema/yaml-schema.ts";
import { languageOptionsValidators } from "./schema/chunk-metadata.ts";

export function partitionCellOptions(
  language: string,
  source: string[],
) {
  const commentChars = langCommentChars(language);
  const optionPrefix = optionCommentPrefix(commentChars[0]);
  const optionSuffix = commentChars[1] || "";

  // find the yaml lines
  const optionsSource: string[] = [];
  const yamlLines: string[] = [];
  for (const line of source) {
    if (line.startsWith(optionPrefix)) {
      if (!optionSuffix || line.trimRight().endsWith(optionSuffix)) {
        let yamlOption = line.substring(optionPrefix.length);
        if (optionSuffix) {
          yamlOption = yamlOption.trimRight();
          yamlOption = yamlOption.substring(
            0,
            yamlOption.length - optionSuffix.length,
          );
        }
        yamlLines.push(yamlOption);
        optionsSource.push(line);
        continue;
      }
    }
    break;
  }

  let yaml = yamlLines.length > 0
    ? readYamlFromString(yamlLines.join("\n"))
    : undefined;

  // check that we got what we expected
  if (
    yaml !== undefined && (typeof (yaml) !== "object" || Array.isArray(yaml))
  ) {
    warnOnce("Invalid YAML option format in cell:\n" + yamlLines.join("\n"));
    yaml = undefined;
  }

  return {
    yaml: yaml as Record<string, unknown> | undefined,
    optionsSource,
    source: source.slice(yamlLines.length),
    sourceStartLine: yamlLines.length,
  };
}

export function partitionCellOptionsMapped(
  language: string,
  source: MappedString,
  validate = false
) {
  const commentChars = langCommentChars(language);
  const optionPrefix = optionCommentPrefix(commentChars[0]);
  const optionSuffix = commentChars[1] || "";

  // find the yaml lines
  const optionsSource: RangedSubstring[] = []; // includes comments
  const yamlLines: RangedSubstring[] = []; // strips comments

  let endOfYaml = 0;
  for (const line of rangedLines(source.value)) {
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
        endOfYaml = line.range.start + optionPrefix.length + yamlOption.length - optionSuffix.length;
        const rangedYamlOption = {
          substring: yamlOption,
          range: {
            start: line.range.start + optionPrefix.length,
            end: endOfYaml
          }
        }
        yamlLines.push(rangedYamlOption);
        optionsSource.push(line);
        continue;
      }
    }
    break;
  }

  let yaml = undefined;
  let yamlValidationErrors: LocalizedError[] = [];
  
  if (yamlLines.length) {
    let yamlMappedString = mappedSource(source, yamlLines);
    const validator = languageOptionsValidators[language];
    
    if (validator === undefined || !validate) {
      yaml = readAnnotatedYamlFromMappedString(yamlMappedString);
    } else {
      const valResult = validator.parseAndValidate(yamlMappedString);
      if (valResult.errors.length > 0) {
        yamlValidationErrors = valResult.errors;
      } else {
        yaml = valResult.result;
      }
      validator.reportErrorsInSource(
        valResult, yamlMappedString,
        `Validation of YAML ${language} chunk options failed`
      );
    }
  }

  return {
    yaml: yaml as Record<string, unknown> | undefined,
    yamlValidationErrors,
    optionsSource,
    source: mappedString(source, [{ start: endOfYaml, end: source.value.length }]), // .slice(yamlLines.length),
    sourceStartLine: yamlLines.length,
  };
}

function mappedSource(source: MappedString | string, substrs: RangedSubstring[])
{
  const params: (Range | string)[] = [];
  for (const { range } of substrs) {
    params.push(range);
    params.push("\n");
  }
  params.pop(); // pop the last "\n"; easier than checking for last iteration
  return mappedString(source, params);
}


function langCommentChars(lang: string): string[] {
  const chars = kLangCommentChars[lang] || "#";
  if (!Array.isArray(chars)) {
    return [chars];
  } else {
    return chars;
  }
}
function optionCommentPrefix(comment: string) {
  return comment + "| ";
}

const kLangCommentChars: Record<string, string | string[]> = {
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
  ojs: "//"
};
