/*
* validated-yaml.ts
*
* lib-safe helper functions for reading and validating YAML
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { MappedString } from "../text-types.ts";
import { readAnnotatedYamlFromMappedString } from "../yaml-intelligence/annotated-yaml.ts";
import { Schema } from "./types.ts";
import {
  withValidator,
  WithValidatorFun,
} from "../yaml-validation/validator-queue.ts";
import { tidyverseFormatError } from "../errors.ts";

import { JSONValue, LocalizedError } from "./types.ts";
import { getSchemaDefinition } from "../yaml-validation/schema.ts";

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
  lenient = false,
): Promise<{
  yaml: { [key: string]: unknown };
  yamlValidationErrors: LocalizedError[];
}> {
  const annotation = await readAnnotatedYamlFromMappedString(
    mappedYaml,
    lenient,
  );
  // FIXME how do we handle _parse_ errors?
  if (annotation === null) {
    throw new Error("Parse error in readAnnotatedYamlFromMappedString");
  }

  const validateYaml = !isObject(annotation.result) ||
    (annotation.result as { [key: string]: JSONValue })["validate-yaml"] !==
      false;

  if (!validateYaml) {
    return {
      yaml: annotation.result as { [key: string]: unknown },
      yamlValidationErrors: [],
    };
  }

  type Res = {
    yaml: { [key: string]: unknown };
    yamlValidationErrors: LocalizedError[];
  };
  const validate: WithValidatorFun<Res> = async (validator) => {
    const valResult = await validator.validateParse(
      mappedYaml,
      annotation,
      pruneErrors,
    );
    return {
      yaml: annotation.result as { [key: string]: unknown },
      yamlValidationErrors: valResult.errors,
    };
  };

  // run the precheck schema on object values,
  // so that partial bad parses get better error messages

  if (
    typeof annotation.result === "object" && !Array.isArray(annotation.result)
  ) {
    const preCheckResult = await withValidator(
      getSchemaDefinition("bad-parse-schema"),
      validate,
    );
    if (preCheckResult.yamlValidationErrors.length !== 0) {
      return preCheckResult;
    }
  }

  const result = await withValidator(schema, validate);
  return result;
}
