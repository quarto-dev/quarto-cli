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

export const BooleanSchema = {
  "type": "boolean",
  "description": "be a boolean value"
};

export const NumberSchema = {
  "type": "number",
  "description": "be a number"
};

export const StringSchema = {
  "type": "string",
  "description": "be a string"
};

export const anySchema = {
  "description": "be anything"
};

// NB this is different from a schema that accepts nothing
// this schema accepts `null`
export const NullSchema = {
  "type": "null",
  "description": "be the null value"
}; 

export function enumSchema(...args: string[])
{
  if (args.length === 0) {
    throw new Error("Internal Error: Empty enum schema not supported.");
  }
  return {
    "enum": args,
    "description": args.length > 1 ? `be one of: ${args.map(x => "'" + x + "'").join(", ")}` : `be '${args[0]}'`
  };
}

export function oneOfSchema(...args: Schema[])
{
  return {
    "oneOf": args,
    "description": `be exactly one of: ${args.map(x => x.description.slice(3, )).join(", ")}`
  };
}

export function anyOfSchema(...args: Schema[])
{
  return {
    "anyOf": args,
    "description": `be at least one of: ${args.map(x => x.description.slice(3, )).join(", ")}`
  };
}

// FIXME: add dynamic check for requiredProps being a subset of the
// keys in properties
export function objectSchema(params: {
  properties?: { [k: string]: Schema },
  required?: string[],
  additionalProperties?: Schema,
  description?: string
} = {}) 
{
  let {
    properties, required, additionalProperties, description
  } = params;
  required = required || [];
  properties = properties || {};
  description = description || "be an object";
  
  const result: Schema = {
    "type": "object",
    description
  };
  
  if (properties) {
    result.properties = properties;
  }
  if (required && required.length > 0) {
    result.required = required;
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
    return {
      "type": "array",
      "description": `be an array of values, where each element should ` + items.description,
      items
    };
  } else {
    return {
      "type": "array",
      "description": `be an array of values`
    };
  }
}
