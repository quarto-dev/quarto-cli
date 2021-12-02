/*
* partition-cell-options.ts
*
* Splits code cell into metadata+options
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import {
  asMappedString,
  MappedString,
} from "./lib/mapped-text.ts";
import {
  langCommentChars,
  optionCommentPrefix,
  partitionCellOptionsMapped as libPartitionCellOptionsMapped,
} from "./lib/partition-cell-options.ts";

import { readYamlFromString } from "./yaml.ts";
import { readAndValidateYamlFromMappedString } from "./schema/validated-yaml.ts";
import { warnOnce } from "./log.ts";

import { getLanguageOptionsSchema } from "./schema/chunk-metadata.ts";

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

export async function parseAndValidateCellOptions(
  mappedYaml: MappedString,
  language: string,
  validate = false,
) {
  if (mappedYaml.value.trim().length === 0) {
    return undefined;
  }

  const languageOptionsSchema = await getLanguageOptionsSchema();
  const schema = languageOptionsSchema[language];

  if (schema === undefined || !validate) {
    return readYamlFromString(mappedYaml.value);
  }

  return readAndValidateYamlFromMappedString(
    mappedYaml,
    schema,
    `Validation of YAML ${language} chunk options failed`,
  );
}

/** NB: this version _does_ parse and validate the YAML source!
 */
export async function partitionCellOptionsMapped(
  language: string,
  outerSource: MappedString,
  validate = false,
) {
  const {
    yaml: mappedYaml,
    optionsSource,
    source,
    sourceStartLine,
  } = await libPartitionCellOptionsMapped(language, outerSource);

  const yaml = await parseAndValidateCellOptions(
    mappedYaml ?? asMappedString(""),
    language,
    validate,
  );

  return {
    yaml: yaml as Record<string, unknown> | undefined,
    optionsSource,
    source,
    sourceStartLine,
  };
}
