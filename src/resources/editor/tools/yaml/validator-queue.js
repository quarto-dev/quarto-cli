/*
* validator-queue.js
*
* FIXME: this has diverged from core/lib/validator-queue because of precompiled validators.
*
* Should we remove validator-queue from core/lib? 
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import * as core from "../../../build/core-lib.js";
import { getLocalPath } from "./paths.js";

const yamlValidators = {};
const validatorQueues = {};

function getSchemaName(schema) {
  const schemaName = schema["$id"] || schema["$ref"];
  if (schemaName === undefined) {
    throw new Error("Expected schema to be named");
  }
  return schemaName;
}

function getValidator(schema, validators) {
  const schemaName = getSchemaName(schema); // name of schema so we can look it up on the validator cache

  if (yamlValidators[schemaName]) {
    return yamlValidators[schemaName];
  }

  const validator = new core.YAMLSchema(schema, validators);

  yamlValidators[schemaName] = validator;
  return validator;
}

export async function withValidator(schema, fun) {
  const schemaName = getSchemaName(schema); // name of schema so we can look it up on the validator cache

  if (validatorQueues[schemaName] === undefined) {
    validatorQueues[schemaName] = new core.PromiseQueue();
  }
  const queue = validatorQueues[schemaName];
  const url = getLocalPath("standalone-schema-validators.js");
  const before = performance.now();
  const validators = (await import(url)).default; // don't use a string literal here to force esbuild to _not_ bundle this file.
  const after = performance.now();
  if (after - before > 60) {
    console.log(`first import took ${after - before}ms`);
  }

  const result = await queue.enqueue(async () => {
    const validator = getValidator(schema, validators);
    try {
      const result = await fun(validator);
      return result;
    } catch (e) {
      console.error("Error in validator queue", e);
      return undefined;
    }
  });

  return result;
}
