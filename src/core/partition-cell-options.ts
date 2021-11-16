/*
* partition-cell-options.ts
*
* Splits code cell into metadata+options
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { error, info } from "log/mod.ts";

import { rangedLines, rangedSubstring, RangedSubstring, Range } from "./lib/ranged-text.ts";
import { asMappedString, mappedString, MappedString } from "./lib/mapped-text.ts";
import {
  partitionCellOptionsMapped as libPartitionCellOptionsMapped,
  langCommentChars,
  optionCommentPrefix,
  kLangCommentChars
} from "./lib/partition-cell-options.ts";

import { readYamlFromString } from "./yaml.ts";
import { readAnnotatedYamlFromMappedString } from "./schema/annotated-yaml.ts";
import { warnOnce } from "./log.ts";

import { LocalizedError } from "./lib/yaml-schema.ts";
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
    yaml !== undefined && (typeof (yaml) !== "object" || Array.isArray(yaml))  ) {
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

export function parseAndValidateCellOptions(
  mappedYaml: MappedString,
  language: string,
  validate = false
) {
  if (mappedYaml.value.trim().length === 0) {
    return {
      yaml: undefined,
      yamlValidationErrors: []
    };
  }

  let yamlValidationErrors: LocalizedError[] = [];
  
  const validator = languageOptionsValidators[language];
  let yaml = undefined;
  if (validator === undefined || !validate) {
    yaml = readAnnotatedYamlFromMappedString(mappedYaml);
  } else {
    const annotation = readAnnotatedYamlFromMappedString(mappedYaml);
    const valResult = validator.validateParse(mappedYaml, annotation);
    if (valResult.errors.length > 0) {
      yamlValidationErrors = valResult.errors;
    } else {
      yaml = valResult.result;
    }
  }
  return {
    yaml,
    yamlValidationErrors
  };
}

/** NB: this version _does_ parse and validate the YAML source!
 */
export function partitionCellOptionsMapped(
  language: string,
  outerSource: MappedString,
  validate = false
) {
  const {
    mappedYaml,
    optionsSource,
    source,
    sourceStartLine
  } = libPartitionCellOptionsMapped(language, outerSource);

  const {
    yaml,
    yamlValidationErrors
  } = parseAndValidateCellOptions(
    mappedYaml ?? asMappedString(""), language, validate);

  if (yamlValidationErrors.length) {
    const validator = languageOptionsValidators[language];
    validator.reportErrorsInSource(
      {
        result: yaml,
        errors: yamlValidationErrors
      }, mappedYaml!,
      `Validation of YAML ${language} chunk options failed`,
      error,
      info
    );
  }
  
  return {
    yaml: yaml as Record<string, unknown> | undefined,
    yamlValidationErrors,
    optionsSource,
    source,
    sourceStartLine
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

