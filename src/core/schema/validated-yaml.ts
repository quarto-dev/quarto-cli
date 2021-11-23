/*
* validated-yaml.ts
*
* helper functions for reading and validating YAML
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { error, info } from "log/mod.ts";
import { Schema } from "../lib/schema.ts";
import { asMappedString, MappedString } from "../mapped-text.ts";
import { readAnnotatedYamlFromMappedString } from "./annotated-yaml.ts";
import { ensureAjv } from "./yaml-schema.ts";
import { withValidator } from "../lib/validator-queue.ts";
import { LocalizedError } from "../lib/yaml-schema.ts";

export async function readAndValidateYamlFromFile(
  file: string,
  schema: Schema,
  errorMsg: string): Promise<unknown>
{
  const contents = asMappedString(Deno.readTextFileSync(file));
  const {
    yaml,
    yamlValidationErrors
  } = await readAndValidateYamlFromMappedString(contents, schema, errorMsg);
  
  if (yamlValidationErrors.length === 0) {
    return yaml;
  } else {
    throw new Error(errorMsg);
  }
}
    
export async function readAndValidateYamlFromMappedString(
  mappedYaml: MappedString,
  schema: any,
  errorMessage: string): Promise<{
    yaml: { [key: string]: unknown },
    yamlValidationErrors: LocalizedError[]
  }>
{
  ensureAjv();
  
  const result = await withValidator(schema, (validator) => {
    const annotation = readAnnotatedYamlFromMappedString(mappedYaml);
    const validateYaml = !(annotation.result?.["validate-yaml"] === false);

    const yaml = annotation.result;
    if (validateYaml) {
      const valResult = validator.validateParse(mappedYaml, annotation);
      if (valResult.errors.length) {
        validator.reportErrorsInSource(
          {
            result: yaml,
            errors: valResult.errors
          }, mappedYaml!,
          errorMessage,
          error,
          info
        );
      }
      return {
        yaml: yaml as { [key: string]: unknown },
        yamlValidationErrors: valResult.errors
      };
    } else {
      return {
        yaml: yaml as { [key: string]: unknown },
        yamlValidationErrors: []
      };
    }
  });
  
  return result;
}
