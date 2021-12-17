/*
* validator-queue.js
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { YAMLSchema, LocalizedError, AnnotatedParse } from "./yaml-schema.ts";
import { PromiseQueue } from "./promise.ts";
import { Schema } from "./schema.ts";

const yamlValidators: Record<string, YAMLSchema> = {};
const validatorQueues: Record<string, PromiseQueue<void>> = {};

function getSchemaName(schema: Schema): string {
  const schemaName = schema["$id"] || schema["$ref"];
  if (schemaName === undefined) {
    throw new Error("Expected schema to be named");
  }
  return schemaName as string;
}

// NB we only support validations on named schema and assume schemas
// don't have clashing names for simplicity of implementation
//
// Ideally, this would be checked by TypeScript.
function getValidator(schema: Schema): YAMLSchema {
  const schemaName = getSchemaName(schema);
  if (yamlValidators[schemaName]) {
    return yamlValidators[schemaName];
  }

  const validator = new YAMLSchema(schema);

  yamlValidators[schemaName] = validator;
  return validator;
}

export async function withValidator<T>(
  schema: Schema,
  fun: (validator: YAMLSchema) => T,
): Promise<T> {
  const schemaName = getSchemaName(schema);

  if (validatorQueues[schemaName] === undefined) {
    validatorQueues[schemaName] = new PromiseQueue();
  }
  const queue = validatorQueues[schemaName];

  // FIXME should we rethrow instead?
  let result: T | undefined;
  let error;
  // deno-lint-ignore require-await
  await queue.enqueue(async () => {
    const validator = getValidator(schema);
    try {
      result = fun(validator);
    } catch (e) {
      console.error("Error in validator queue", e);
      error = e;
    }
  });

  if (error !== undefined) {
    throw error;
  }

  return result!;
}

export function addValidatorErrorHandler(
  schema: Schema,
  handler: (error: LocalizedError,
            parse: AnnotatedParse,
            schema: Schema) => LocalizedError
) {
  return withValidator(schema, (validator) => {
    validator.addHandler(handler);
  })
}
