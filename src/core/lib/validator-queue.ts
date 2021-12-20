/*
* validator-queue.js
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { YAMLSchema, LocalizedError, AnnotatedParse } from "./yaml-schema.ts";
import { PromiseQueue } from "./promise.ts";
import { Schema } from "./schema.ts";
import { tidyverseInfo, tidyverseError } from "../log.ts";

const yamlValidators: Record<string, YAMLSchema> = {};
const validatorQueues: Record<string, PromiseQueue<void>> = {};

function checkForBadBoolean(
  error: LocalizedError, parse: AnnotatedParse, schema: Schema
)
{
  schema = error.error.params.schema;
  if (!(typeof error.violatingObject.result === "string" &&
    error.error.keyword === "type" &&
    schema?.type === "boolean")) {
    return error;
  }
  const strValue = error.violatingObject.result;
  const verbatimInput = error.source.value.substring(
    error.violatingObject.start,
    error.violatingObject.end);

  // from https://yaml.org/type/bool.html
  const yesses = new Set("y|Y|yes|Yes|YES|true|True|TRUE|on|On|ON".split("|"));
  const nos = new Set("n|N|no|No|NO|false|False|FALSE|off|Off|OFF".split("|"));
  let fix;
  if (yesses.has(strValue)) {
    fix = true;
  } else if (nos.has(strValue)) {
    fix = false;
  } else {
    return error;
  }

  const errorHeading = `${error.location}: \`${verbatimInput}\` must be a boolean`;
  const errorMessage = tidyverseError(`\`${verbatimInput}\` is a string.`);
  const suggestion1 = tidyverseInfo(`Quarto uses YAML 1.2, which interprets booleans strictly.`)
  const suggestion2 = tidyverseInfo(`Did you mean \`${fix}\` instead?`);
  return {
    ...error,
    message: [errorHeading, errorMessage, suggestion1, suggestion2].join("\n")
  };
}

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

  // FIXME where do we declare all of the standard validator error handlers?
  validator.addHandler(checkForBadBoolean);
  
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
