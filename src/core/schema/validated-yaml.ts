/*
* validated-yaml.ts
*
* helper functions for reading and validating YAML
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { errorOnce } from "../log.ts";
import { info } from "log/mod.ts";
import { asMappedString, MappedString } from "../mapped-text.ts";
import { readAnnotatedYamlFromMappedString } from "./annotated-yaml.ts";
import { Schema } from "../lib/yaml-validation/schema.ts";
import { withValidator } from "../lib/yaml-validation/validator-queue.ts";
import { LocalizedError } from "../lib/yaml-validation/yaml-schema.ts";
import { relative } from "path/mod.ts";

// https://stackoverflow.com/a/41429145
export class ValidationError extends Error {
  validationErrors: LocalizedError[];

  constructor(msg: string, validationErrors: LocalizedError[]) {
    super(msg);

    Object.setPrototypeOf(this, ValidationError.prototype);
    this.validationErrors = validationErrors;
  }
}

export function readAndValidateYamlFromFile(
  file: string,
  schema: Schema,
  errorMessage: string,
): Promise<unknown> {
  if (!existsSync(file)) {
    throw new Error(`YAML file ${file} not found.`);
  }

  let shortFileName = file;
  if (shortFileName.startsWith("/")) {
    shortFileName = relative(Deno.cwd(), shortFileName);
  }

  const contents = asMappedString(Deno.readTextFileSync(file), shortFileName);
  return readAndValidateYamlFromMappedString(contents, schema, errorMessage);
}

export async function readAndValidateYamlFromMappedString(
  mappedYaml: MappedString,
  schema: Schema,
  errorMessage: string,
): Promise<{ [key: string]: unknown }> {
  const result = await withValidator(schema, async (validator) => {
    const annotation = readAnnotatedYamlFromMappedString(mappedYaml);
    const validateYaml = !(annotation.result?.["validate-yaml"] === false);

    const yaml = annotation.result;
    if (validateYaml) {
      const valResult = await validator.validateParse(mappedYaml, annotation);
      if (valResult.errors.length) {
        validator.reportErrorsInSource(
          {
            result: yaml,
            errors: valResult.errors,
          },
          mappedYaml!,
          errorMessage,
          (msg) => {
            if (!errorOnce(msg)) {
              info(""); // line break
            }
          },
          info,
        );
      }
      return {
        yaml: yaml as { [key: string]: unknown },
        yamlValidationErrors: valResult.errors,
      };
    } else {
      return {
        yaml: yaml as { [key: string]: unknown },
        yamlValidationErrors: [],
      };
    }
  });

  if (result.yamlValidationErrors.length > 0) {
    throw new ValidationError(errorMessage, result.yamlValidationErrors);
  }

  return result.yaml;
}
