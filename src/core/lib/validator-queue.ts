/*
* validator-queue.js
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { YAMLSchema, LocalizedError, AnnotatedParse } from "./yaml-schema.ts";
import { PromiseQueue } from "./promise.ts";
import { Schema } from "./schema.ts";
import { tidyverseFormatError, TidyverseError, quotedStringColor, addFileInfo, addInstancePathInfo } from "./errors.ts";

const yamlValidators: Record<string, YAMLSchema> = {};
const validatorQueues: Record<string, PromiseQueue<void>> = {};

function checkForTypeMismatch(
  error: LocalizedError, parse: AnnotatedParse, schema: Schema
)
{
  schema = error.error.params.schema;
  const verbatimInput = error.source.value.substring(
    error.violatingObject.start,
    error.violatingObject.end);
  
  if (error.error.keyword === "type") {
    // console.log(JSON.stringify(error, null, 2));
    const newError: TidyverseError = {
      heading: `${error.location}: The value ${quotedStringColor(verbatimInput)} must be a ${error.error.params.type}.`,
      error: [`The value ${quotedStringColor(verbatimInput)} is a ${typeof error.violatingObject.result}.`],
      info: []
    };
    addInstancePathInfo(newError, error.error.instancePath);
    addFileInfo(newError, error.source);
    return {
      ...error,
      message: tidyverseFormatError(newError)
    };
  }
  return error;
}

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

  const heading = `${error.location}: The value ${quotedStringColor(verbatimInput)} must be a boolean`;
  const errorMessage = `The value ${quotedStringColor(verbatimInput)} is a string.`;
  const suggestion1 = `Quarto uses YAML 1.2, which interprets booleans strictly.`;
  const suggestion2 = `Try using ${quotedStringColor(String(fix))} instead.`;
  const newError: TidyverseError = {
    heading,
    error: [errorMessage],
    info: []
  };
  addInstancePathInfo(newError, error.error.instancePath);
  addFileInfo(newError, error.source);
  newError.info.push(suggestion1, suggestion2);
  return {
    ...error,
    message: tidyverseFormatError(newError)
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
  validator.addHandler(checkForTypeMismatch);
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
