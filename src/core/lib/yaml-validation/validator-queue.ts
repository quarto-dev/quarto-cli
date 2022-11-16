/*
* validator-queue.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { YAMLSchema } from "./yaml-schema.ts";

import { setDefaultErrorHandlers } from "./errors.ts";

import { ValidatorErrorHandlerFunction } from "./types.ts";

import { RefSchema, Schema, schemaType } from "../yaml-schema/types.ts";

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

export type WithValidatorFun<T> = (validator: YAMLSchema) => Promise<T>;
export async function withValidator<T>(
  schema: Schema,
  fun: WithValidatorFun<T>,
): Promise<T> {
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
