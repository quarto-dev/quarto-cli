/*
* validated-yaml.ts
*
* helper functions for reading and validating YAML
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { asMappedString } from "../mapped-text.ts";
import { Schema } from "../lib/yaml-schema/types.ts";
import { relative } from "path/mod.ts";

import {
  readAndValidateYamlFromMappedString,
  ValidationError,
} from "../lib/yaml-schema/validated-yaml.ts";

export { ValidationError } from "../lib/yaml-schema/validated-yaml.ts";

export async function readAndValidateYamlFromFile(
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

  const contents = asMappedString(
    Deno.readTextFileSync(file).trimEnd(),
    shortFileName,
  );
  const {
    yaml,
    yamlValidationErrors,
  } = await readAndValidateYamlFromMappedString(contents, schema);

  if (yamlValidationErrors.length) {
    throw new ValidationError(errorMessage, yamlValidationErrors);
  }
  return yaml;
}

/*export async function readAndValidateYamlFromMappedString(
  mappedYaml: MappedString,
  schema: Schema,
  errorMessage: string,
): Promise<{ [key: string]: unknown }> {
  const result = await withValidator(schema, async (validator) => {
    const annotation = readAnnotatedYamlFromMappedString(mappedYaml)!;
    const validateYaml = !isObject(annotation.result) ||
      (annotation.result as { [key: string]: JSONValue })["validate-yaml"] !==
        false;

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
          (a: TidyverseError) => {
            error(tidyverseFormatError(a), { colorize: false });
          },
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
}*/
