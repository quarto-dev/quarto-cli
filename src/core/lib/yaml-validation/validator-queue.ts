/*
* validator-queue.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import {
  AnnotatedParse,
  getVerbatimInput,
  LocalizedError,
  YAMLSchema,
} from "./yaml-schema.ts";
import { PromiseQueue } from "../promise.ts";
import { Schema } from "./schema.ts";
import {
  addFileInfo,
  addInstancePathInfo,
  quotedStringColor,
  TidyverseError,
} from "../errors.ts";

const yamlValidators: Record<string, YAMLSchema> = {};
const validatorQueues: Record<string, PromiseQueue<void>> = {};

function checkForTypeMismatch(
  error: LocalizedError,
  _parse: AnnotatedParse,
  _schema: Schema,
) {
  const verbatimInput = quotedStringColor(getVerbatimInput(error));

  if (error.ajvError.keyword === "type") {
    const newError: TidyverseError = {
      heading:
        `The value ${verbatimInput} must be a ${error.ajvError.params.type}.`,
      error: [
        `The value ${verbatimInput} is a ${typeof error.violatingObject
          .result}.`,
      ],
      info: [],
      location: error.niceError.location,
    };
    addInstancePathInfo(newError, error.ajvError.instancePath);
    addFileInfo(newError, error.source);
    return {
      ...error,
      niceError: newError,
    };
  }
  return error;
}

function checkForBadBoolean(
  error: LocalizedError,
  _parse: AnnotatedParse,
  schema: Schema,
) {
  schema = error.ajvError.params.schema;
  if (
    !(typeof error.violatingObject.result === "string" &&
      error.ajvError.keyword === "type" &&
      (schema && schema.type === "boolean"))
  ) {
    return error;
  }
  const strValue = error.violatingObject.result;
  const verbatimInput = quotedStringColor(getVerbatimInput(error));

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

  const heading = `The value ${verbatimInput} must be a boolean`;
  const errorMessage = `The value ${verbatimInput} is a string.`;
  const suggestion1 =
    `Quarto uses YAML 1.2, which interprets booleans strictly.`;
  const suggestion2 = `Try using ${quotedStringColor(String(fix))} instead.`;
  const newError: TidyverseError = {
    heading,
    error: [errorMessage],
    info: [],
    location: error.niceError.location,
  };
  addInstancePathInfo(newError, error.ajvError.instancePath);
  addFileInfo(newError, error.source);
  newError.info.push(suggestion1, suggestion2);
  return {
    ...error,
    niceError: newError,
  };
}

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

  // FIXME where do we declare all of the standard validator error handlers?
  validator.addHandler(checkForTypeMismatch);
  validator.addHandler(checkForBadBoolean);

  return validator;
}

export async function withValidator<T>(
  schema: Schema,
  fun: (validator: YAMLSchema) => Promise<T>,
): Promise<T> {
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
      error = e;
    }
  });

  if (error !== undefined) {
    throw error;
  }

  return result! as T;
}

export type ValidatorErrorHandlerFunction = (
  error: LocalizedError,
  parse: AnnotatedParse,
  schema: Schema,
) => LocalizedError;

export function addValidatorErrorHandler(
  schema: Schema,
  handler: ValidatorErrorHandlerFunction,
) {
  // deno-lint-ignore require-await
  return withValidator(schema, async (validator) => {
    validator.addHandler(handler);
  });
}
