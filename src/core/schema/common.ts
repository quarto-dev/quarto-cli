/*
* common.ts
*
* Common JSON Schema objects
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// we build up our little schema combinator library here.
// Right now it just emits a JSON schema but this is setting up for
// when we want to enrich our schema with other things like documentation etc

// FIXME clearly we need to do better here.
// deno-lint-ignore no-explicit-any
export type Schema = any;

export const BooleanSchema = { "type": "boolean" };
export const NumberSchema = { "type": "number" };
export const StringSchema = { "type": "string" };

// NB this is different from a schema that accepts nothing
// this schema accepts `null`
export const NullSchema = { "type": "null" }; 

export function enumSchema(...args: string[])
{
  return { "enum": args };
}

export function oneOfSchema(...args: Schema[])
{
  return { "oneOf": args };
}

// FIXME: add dynamic check for requiredProps being a subset of the
// keys in properties
export function objectSchema(
  properties?: { [k: string]: Schema },
  requiredProps?: string[],
  additionalProperties?: Schema
) 
{
  const result: Schema = { "type": "object" };
  if (properties) {
    result.properties = properties;
  }
  if (requiredProps && requiredProps.length > 0) {
    result.required = requiredProps;
  }
  // this is useful to characterize Record<string, foo> types: use
  // objectSchema({}, [], foo)
  if (additionalProperties) {
    result.additionalProperties = additionalProperties;
  }
  return result;
}

export function arraySchema(items?: Schema)
{
  if (items) {
    return { "type": "array", items };
  } else {
    return { "type": "array" };
  }
}
