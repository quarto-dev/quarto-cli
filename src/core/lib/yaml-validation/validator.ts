/*
* validator.ts
*
* A minimalistic pure-yes-or-no YAML validator that we call before
* importing the ajv precompiled modules (ajv precompiled modules do
* good error reporting but take a long time to load).
*
* This only supports a small subset of JSON schema
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { getSchemaDefinition, Schema, schemaType } from "./schema.ts";
import { resolveSchema } from "./schema-utils.ts";

// deno-lint-ignore no-explicit-any
function validateBoolean(value: any, _schema: Schema) {
  return typeof value === "boolean";
}

// deno-lint-ignore no-explicit-any
function validateNumber(value: any, _schema: Schema) {
  return typeof value === "number";
}

// deno-lint-ignore no-explicit-any
function validateString(value: any, schema: Schema) {
  if (typeof value !== "string") {
    return false;
  }
  if (schema.pattern === undefined) {
    return true;
  }
  if (value.match(new RegExp(schema.pattern as string))) {
    return true;
  } else {
    return false;
  }
}

// deno-lint-ignore no-explicit-any
function validateNull(value: any, _schema: Schema) {
  return value === null;
}

// deno-lint-ignore no-explicit-any
function validateEnum(value: any, schema: Schema) {
  return schema["enum"].indexOf(value) !== -1;
}

// deno-lint-ignore no-explicit-any
function validateOneOf(value: any, schema: Schema) {
  let count = 0;
  for (const subSchema of schema.oneOf) {
    if (validate(value, subSchema)) {
      count += 1;
      if (count > 1) {
        return false;
      }
    }
  }
  return count === 1;
}

// deno-lint-ignore no-explicit-any
function validateAnyOf(value: any, schema: Schema) {
  for (const subSchema of schema.anyOf) {
    if (validate(value, subSchema)) {
      return true;
    }
  }

  return false;
}

// deno-lint-ignore no-explicit-any
function validateAllOf(value: any, schema: Schema) {
  for (const subSchema of schema.allOf) {
    if (!validate(value, subSchema)) {
      return false;
    }
  }

  return true;
}

// deno-lint-ignore no-explicit-any
function validateObject(value: any, schema: Schema) {
  if (typeof value !== "object" || Array.isArray(value) || value === null) {
    return false;
  }
  const inspectedProps: Set<string> = new Set();
  const ownProperties: Set<string> = new Set(Object.getOwnPropertyNames(value));
  if (schema.properties !== undefined) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      // can't check for truthiness here because value might be falsey
      // and yet we still need to check it.
      if (ownProperties.has(key)) {
        inspectedProps.add(key);
        if (!validate(value[key], subSchema)) {
          return false;
        }
      }
    }
  }
  if (schema.patternProperties !== undefined) {
    // there's probably a more efficient way to do this..
    for (const [key, subSchema] of Object.entries(schema.patternProperties)) {
      const regexp = new RegExp(key);
      for (const [objectKey, val] of Object.entries(value)) {
        if (objectKey.match(regexp)) {
          inspectedProps.add(objectKey);
          if (!validate(val, subSchema)) {
            return false;
          }
        }
      }
    }
  }
  if (schema.additionalProperties !== undefined) {
    for (const [objectKey, val] of Object.entries(value)) {
      if (inspectedProps.has(objectKey)) {
        continue;
      }
      if (!validate(val, schema.additionalProperties)) {
        return false;
      }
    }
  }
  if (schema.propertyNames !== undefined) {
    for (const key of ownProperties) {
      if (!validate(key, schema.propertyNames)) {
        return false;
      }
    }
  }
  for (const reqKey of schema.required || []) {
    if (value[reqKey] === undefined) {
      return false;
    }
  }
  return true;
}

// deno-lint-ignore no-explicit-any
function validateArray(value: any, schema: Schema) {
  if (!Array.isArray(value)) {
    return false;
  }
  if (schema.items !== undefined) {
    return value.every((entry) => validate(entry, schema.items));
  }
  return true;
}

// deno-lint-ignore no-explicit-any
export function validate(value: any, schema: Schema) {
  if (schema === false) {
    return false;
  }
  if (schema === true) {
    return true;
  }
  // deno-lint-ignore no-explicit-any
  const validators: Record<string, (value: any, schema: Schema) => boolean> = {
    "boolean": validateBoolean,
    "number": validateNumber,
    "string": validateString,
    "null": validateNull,
    "enum": validateEnum,
    "oneOf": validateOneOf,
    "anyOf": validateAnyOf,
    "allOf": validateAllOf,
    "object": validateObject,
    "array": validateArray,
  };

  schema = resolveSchema(schema);
  const v = validators[schemaType(schema)];
  if (v) {
    return v(value, schema);
  } else {
    throw new Error(`Don't know how to validate type ${schema.type}`);
  }
}
