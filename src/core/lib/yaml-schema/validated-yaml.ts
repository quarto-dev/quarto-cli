/*
* validated-yaml.ts
*
* lib-safe helper functions for reading and validating YAML
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { MappedString } from "../text-types.ts";
import { readAnnotatedYamlFromMappedString } from "../yaml-intelligence/annotated-yaml.ts";
import { Schema } from "./types.ts";
import { withValidator } from "../yaml-validation/validator-queue.ts";
import { tidyverseFormatError } from "../errors.ts";

import { JSONValue, LocalizedError } from "./types.ts";

export class ValidationError extends Error {
  validationErrors: LocalizedError[];

  constructor(msg: string, validationErrors: LocalizedError[]) {
    super(
      [msg, ...validationErrors.map((e) => tidyverseFormatError(e.niceError))]
        .join(
          "\n\n",
        ),
    );

    Object.setPrototypeOf(this, ValidationError.prototype);
    this.validationErrors = validationErrors;
  }
}

// we don't pull all of lodash into lib for this one check
const isObject = (value: unknown) => {
  const type = typeof value;
  return value !== null && (type === "object" || type === "function");
};

export async function readAndValidateYamlFromMappedString(
  mappedYaml: MappedString,
  schema: Schema,
  pruneErrors = true,
): Promise<{
  yaml: { [key: string]: unknown };
  yamlValidationErrors: LocalizedError[];
}> {
  const result = await withValidator(schema, async (validator) => {
    const annotation = await readAnnotatedYamlFromMappedString(mappedYaml);
    // FIXME how do we handle _parse_ errors?
    if (annotation === null) {
      throw new Error("Parse error in readAnnotatedYamlFromMappedString");
    }

    const validateYaml = !isObject(annotation.result) ||
      (annotation.result as { [key: string]: JSONValue })["validate-yaml"] !==
        false;

    const yaml = annotation.result;
    if (validateYaml) {
      const valResult = await validator.validateParse(
        mappedYaml,
        annotation,
        pruneErrors,
      );
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

  return result;
}
