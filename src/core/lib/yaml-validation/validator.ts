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


import { Schema, getSchemaDefinition, schemaType } from "./schema.ts";

function validateBoolean(value: any, schema: Schema)
{
  return typeof value === 'boolean';
}

function validateNumber(value: any, schema: Schema)
{
  return typeof value === 'number';
}

function validateString(value: any, schema: Schema)
{
  if (typeof value !== 'string')
    return false;
  if (schema.pattern === undefined)
    return true;
  if (value.match(new RegExp(schema.pattern as string))) {
    return true;
  } else {
    return false;
  }
}

function validateNull(value: any, schema: Schema)
{
  return value === null;
}

function validateEnum(value: any, schema: Schema)
{
  return schema["enum"].indexOf(value) !== -1;
}

function validateOneOf(value: any, schema: Schema)
{
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

function validateAnyOf(value: any, schema: Schema)
{
  for (const subSchema of schema.anyOf) {
    if (validate(value, subSchema)) {
      return true;
    }
  }

  return false;
}

function validateAllOf(value: any, schema: Schema)
{
  for (const subSchema of schema.allOf) {
    if (!validate(value, subSchema)) {
      return false;
    }
  }

  return true;
}

function validateObject(value: any, schema: Schema)
{
  if (typeof value !== "object" || Array.isArray(value) || value === null) {
    return false;
  }
  const inspectedProps: Set<string> = new Set();
  if (schema.properties) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (value[key] && !validate(value[key], subSchema)) {
        return false;
      } else {
        inspectedProps.add(key);
      }
    }
  }
  if (schema.patternProperties) {
    // there's probably a more efficient way to do this..
    for (const [key, subSchema] of Object.entries(schema.patternProperties)) {
      const regexp = new RegExp(key);
      for (const [objectKey, val] of Object.entries(value)) {
        if (objectKey.match(regexp) && !validate(val, subSchema)) {
          return false;
        } else {
          inspectedProps.add(objectKey);
        }
      }
    }
  }
  if (schema.additionalProperties) {
    for (const [objectKey, val] of Object.entries(value)) {
      if (inspectedProps.has(objectKey)) {
        continue;
      }
      if (!validate(val, schema.additionalProperties)) {
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

function validateArray(value: any, schema: Schema)
{
  if (!Array.isArray(value)) {
    return false;
  }
  if (schema.items) {
    return value.every(entry => validate(entry, schema.items));
  }
  return true;
}

export function validate(value: any, schema: Schema)
{
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
    "array": validateArray
  };

  if (schema.$ref || schema.$id) {
    schema = getSchemaDefinition(schema.$ref || schema.$id);
  }
  if (validators[schemaType(schema)]) {
    return validators[schemaType(schema)](value, schema);
  } else {
    throw new Error(`Don't know how to validate ${schema.type}`);
  }
}
