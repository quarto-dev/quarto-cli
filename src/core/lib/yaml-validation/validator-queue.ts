/*
* validator-queue.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { YAMLSchema } from "./yaml-schema.ts";

import { PromiseQueue } from "../promise.ts";

import { Schema } from "./schema.ts";

import {
  setDefaultErrorHandlers,
  ValidatorErrorHandlerFunction,
} from "./errors.ts";

import { RefSchema, schemaType } from "./validator/types.ts";

const yamlValidators: Record<string, YAMLSchema> = {};

function getSchemaName(schema: Schema): string {
  if (schema === true || schema === false) {
    throw new Error("Expected schema to be named");
  }

  let schemaName = schema["$id"];
  if (schemaName !== undefined) {
    return schemaName;
  }

  if (schemaType(schema) === "ref") {
    schemaName = (schema as RefSchema)["$ref"];
  }
  if (schemaName !== undefined) {
    return schemaName;
  }

  throw new Error("Expected schema to be named");
}

function getValidator(schema: Schema): YAMLSchema {
  const schemaName = getSchemaName(schema); // name of schema so we can look it up on the validator cache
  if (yamlValidators[schemaName]) {
    return yamlValidators[schemaName];
  }

  const validator = new YAMLSchema(schema);

  yamlValidators[schemaName] = validator;

  setDefaultErrorHandlers(validator);

  return validator;
}

export async function withValidator<T>(
  schema: Schema,
  fun: (validator: YAMLSchema) => Promise<T>,
): Promise<T> {
  const schemaName = getSchemaName(schema); // name of schema so we can look it up on the validator cache
  let result: T | undefined;
  let error;
  try {
    const validator = getValidator(schema);
    result = await fun(validator);
  } catch (e) {
    error = e;
  }

  if (error !== undefined) {
    throw error;
  }

  return result! as T;
}

export function addValidatorErrorHandler(
  schema: Schema,
  handler: ValidatorErrorHandlerFunction,
) {
  // deno-lint-ignore require-await
  return withValidator(schema, async (validator) => {
    validator.addHandler(handler);
  });
}
