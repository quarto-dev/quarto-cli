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

import { getLocalPath } from "./paths.ts";
import { Schema } from "../schema.ts";
import { YAMLSchema } from "../yaml-schema.ts";
import { PromiseQueue } from "../promise.ts";

// not great, but we need it for testing on deno side.
import { resourcePath } from "../../resources.ts";

const yamlValidators: Record<string, YAMLSchema> = {};
const validatorQueues: Record<string, PromiseQueue> = {};

function getSchemaName(schema: Schema): string {
  const schemaName = schema["$id"] || schema["$ref"];
  if (schemaName === undefined) {
    throw new Error("Expected schema to be named");
  }
  return schemaName as string;
}

function getValidator(schema: Schema, validators?: any): YAMLSchema {
  const schemaName = getSchemaName(schema); // name of schema so we can look it up on the validator cache

  if (yamlValidators[schemaName]) {
    return yamlValidators[schemaName];
  }

  const validator = new YAMLSchema(schema, validators);

  yamlValidators[schemaName] = validator;
  return validator;
}

let _isDeno: boolean | undefined = undefined;
function isDeno() {
  if (_isDeno !== undefined) {
    return _isDeno;
  }
  
  try {
    // force some "safe" Deno.* call here.
    _isDeno = Deno.osRelease() !== undefined;
  } catch (e) {
    _isDeno = false;
  }
  return _isDeno;
}

let _module: any;
async function getValidatorModule()
{
  if (_module)
    return _module;
  if (isDeno()) {
    _module = (await import(resourcePath("editor/tools/yaml/standalone-schema-validators.js"))).default;
  } else {
    const url = getLocalPath("standalone-schema-validators.js");
    _module = (await import(url)).default;
  }
  return _module;
}

export async function withValidator<T>(schema: Schema, fun: (validator: YAMLSchema) => Promise<T>): Promise<T> {
  const schemaName = getSchemaName(schema); // name of schema so we can look it up on the validator cache
  if (validatorQueues[schemaName] === undefined) {
    validatorQueues[schemaName] = new PromiseQueue();
  }
  const queue = validatorQueues[schemaName]!;
  const before = performance.now();
  const validators = await getValidatorModule();
  const after = performance.now();
  if (after - before > 60) {
    console.log(`first import took ${after - before}ms`);
  }

  const result = await queue.enqueue(async () => {
    const validator = getValidator(schema, validators);
    const result = await fun(validator);
    return result;
  });

  // the promise queue doesn't preserve types, so we cast.
  return result as T;
}
