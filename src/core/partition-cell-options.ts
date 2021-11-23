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
import { readAndValidateYamlFromMappedString } from "./schema/validated-yaml.ts";
import { readAnnotatedYamlFromMappedString } from "./schema/annotated-yaml.ts";
import { warnOnce } from "./log.ts";

import { languageOptionsSchema } from "./schema/chunk-metadata.ts";

// force ajv initialization. Yes, this is ugly.
import { ensureAjv } from "./schema/yaml-schema.ts";

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

export async function parseAndValidateCellOptions(
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

  const schema = languageOptionsSchema[language];
  const schemaName = language;

  if (schema === undefined || !validate) {
    return {
      yaml: readYamlFromString(mappedYaml.value),
      yamlValidationErrors: []
    }
  }

  return readAndValidateYamlFromMappedString(
    mappedYaml, schema, 
    `Validation of YAML ${language} chunk options failed`
  );
}

/** NB: this version _does_ parse and validate the YAML source!
 */
export async function partitionCellOptionsMapped(
  language: string,
  outerSource: MappedString,
  validate = false
) {
  const {
    mappedYaml,
    optionsSource,
    source,
    sourceStartLine
  } = await libPartitionCellOptionsMapped(language, outerSource);

  const {
    yaml,
    yamlValidationErrors
  } = await parseAndValidateCellOptions(
    mappedYaml ?? asMappedString(""), language, validate);
   
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

