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

const yamlValidators: Record<string, YAMLSchema> = {};
const validatorQueues: Record<string, PromiseQueue<void>> = {};

function getSchemaName(schema: Schema): string {
  const schemaName = schema["$id"] || schema["$ref"];
  if (schemaName === undefined) {
    throw new Error("Expected schema to be named");
  }
  return schemaName as string;
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
  debugger;
  const schemaName = getSchemaName(schema); // name of schema so we can look it up on the validator cache
  if (validatorQueues[schemaName] === undefined) {
    validatorQueues[schemaName] = new PromiseQueue();
  }
  const queue = validatorQueues[schemaName]!;

  let result: T | undefined;
  let error;
  await queue.enqueue(async () => {
    try {
      const validator = getValidator(schema);
      result = await fun(validator);
    } catch (e) {
      console.log("catch");
      error = e;
    }
  });

  if (error !== undefined) {
    console.log("There was an error!", error);
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
