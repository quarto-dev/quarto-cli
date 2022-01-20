/*
* staged-validator.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { Schema, getSchemaDefinition, hasSchemaDefinition } from "./schema.ts";
import { validate } from "./validator.ts";

// this is an interface from ajv which we're repeating here for build
// simplicity
export interface ErrorObject {
  keyword: string; // validation keyword.
  instancePath: string; // JSON Pointer to the location in the data instance (e.g., `"/prop/1/subProp"`).
  schemaPath: string; // JSON Pointer to the location of the failing keyword in the schema
  // deno-lint-ignore no-explicit-any
  params: any; // type is defined by keyword value, see below
  // params property is the object with the additional information about error
  // it can be used to generate error messages
  // (e.g., using [ajv-i18n](https://github.com/ajv-validator/ajv-i18n) package).
  // See below for parameters set by all keywords.
  propertyName?: string; // set for errors in `propertyNames` keyword schema.
  // `instancePath` still points to the object in this case.
  message?: string; // the error message (can be excluded with option `messages: false`).
  // Options below are added with `verbose` option:
  // deno-lint-ignore no-explicit-any
  schema?: any; // the value of the failing keyword in the schema.

  // NB we use "object" here because it's the typing given by ajv, even though deno lint doesn't like it.
  // deno-lint-ignore ban-types
  parentSchema?: object; // the schema containing the keyword.
  // deno-lint-ignore no-explicit-any
  data?: any; // the data validated by the keyword.

  // a flag required by our internal processing to keep track of whether an error has been transformed
  hasBeenTransformed?: boolean;
}

type StagedValidatorResult = ErrorObject[];

// deno-lint-ignore no-explicit-any
let _module: any = undefined;

let validatorModulePath = "";
// FIXME there's still a race here if ensureValidatorModule gets called twice in quick succession...
async function ensureValidatorModule()
{
  if (_module) {
    return _module;
  }

  if (validatorModulePath === "") {
    throw new Error("Internal Error: validator module path is not set");
  }
  
  const path = new URL(validatorModulePath, import.meta.url).href;
  const _mod = await import(path);
  _module = _mod.default;
  return _module;
}

// we can't hardcode this because it's different from IDE and CLI
// and we're in core/lib so can't call resourcePath() anyway.
export function setValidatorModulePath(
  path: string
) {
  validatorModulePath = path;
}

export function stagedValidator(schema: Schema):
(schema: Schema) => Promise<ErrorObject[]> {
  const schemaName: string = schema.$id || schema.$ref;
  
  if (!hasSchemaDefinition(schemaName)) {
    throw new Error(`Internal error: can't find schema ${schemaName}`);
  }
  schema = getSchemaDefinition(schemaName); // this resolves $ref schemas if they were such

  return async (value) => {
    if (validate(value, schema)) {
      return [];
    }
    await ensureValidatorModule();
    const validator = _module[schema.$id || schema.$ref];
    if (validator(value)) {
      throw new Error(`Internal error: validators disagree on schema ${schema.$id}`);
    }

    // we don't call cloneDeep here to avoid pulling lodash into core/lib
    return JSON.parse(JSON.stringify(validator.errors)) as ErrorObject[];
  };
}
