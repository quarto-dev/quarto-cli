/*
* from-yaml.ts
*
* Functions to convert YAML to JSON Schema
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { readAnnotatedYamlFromString } from "./annotated-yaml.ts";

import { error } from "log/mod.ts";

import {
  Schema
} from "../lib/schema.ts";

import {
  idSchema as withId,
  StringSchema as stringS,
  BooleanSchema as booleanS,
  NullSchema as nullS,
  NumberSchema as numberS,
  objectSchema as objectS,
  anySchema as anyS,
  refSchema as refS,
  arraySchema as arrayOfS,
  oneOfSchema as oneOfS,
  anyOfSchema as anyOfS,
  enumSchema as enumS,
  documentSchema,
  completeSchema,
  completeSchemaOverwrite,
  valueSchema,
} from "./common.ts";

function setBaseSchemaProperties(yaml: any, schema: Schema): Schema
{
  if (yaml.additionalCompletions)
    schema = completeSchema(schema, yaml.additionalCompletions);
  if (yaml.completions)
    schema = completeSchemaOverwrite(schema, yaml.completions);
  if (yaml.id)
    schema = withId(schema, yaml.id);
  if (yaml.hidden === false) {
    // don't complete anything through a `hidden` field
    schema = completeSchemaOverwrite(schema);
  }

  // FIXME in YAML schema, we call it description
  // in the JSON objects, we call that "documentation"

  if (yaml.description) {
    if (typeof yaml.description === "string") {
      schema = documentSchema(schema, yaml.description);
    } else if (typeof yaml.description === "object") {
      schema = documentSchema(schema, yaml.description.short);
    }
  }
  
  // FIXME handle hidden here
  return schema;
}

function convertFromNull(yaml: any, _dict: Record<string, Schema>): Schema
{
  return setBaseSchemaProperties(yaml, nullS);
}

function convertFromString(yaml: any, _dict: Record<string, Schema>): Schema
{
  return setBaseSchemaProperties(yaml, stringS);
}

function convertFromPath(yaml: any, _dict: Record<string, Schema>): Schema
{
  return setBaseSchemaProperties(yaml, stringS);
}

function convertFromNumber(yaml: any, _dict: Record<string, Schema>): Schema
{
  return setBaseSchemaProperties(yaml, numberS);
}

function convertFromBoolean(yaml: any, _dict: Record<string, Schema>): Schema
{
  return setBaseSchemaProperties(yaml, booleanS);
}

function convertFromRef(yaml: any, _dict: Record<string, Schema>): Schema
{
  return refS(yaml.ref, yaml.description || "");
}

function convertFromMaybeArrayOf(yaml: any, dict: Record<string, Schema>): Schema
{
  const schema = convertFromYaml(yaml.maybeArrayOf, dict);
  return oneOfS(schema, arrayOfS(schema));
};

function convertFromArrayOf(yaml: any, dict: Record<string, Schema>): Schema
{
  const schema = yaml.arrayOf;
  if (schema.schema) {
    let result = arrayOfS(convertFromYaml(schema.schema, dict));
    return setBaseSchemaProperties(schema, result);
  } else {
    return arrayOfS(convertFromYaml(schema, dict));
  }
};

function convertFromOneOf(yaml: any, dict: Record<string, Schema>): Schema
{
  const schema = yaml.oneOf;
  if (schema.schemas) {
    let inner = schema.schemas.map((x: any) => convertFromYaml(x, dict));
    let result = oneOfS(...inner);
    return setBaseSchemaProperties(schema, result);
  } else {
    return oneOfS(...schema.map((x: any) => convertFromYaml(x, dict)));
  }
};

function convertFromAnyOf(yaml: any, dict: Record<string, Schema>): Schema
{
  const schema = yaml.anyOf;
  if (schema.schemas) {
    let result = anyOfS(...schema.schemas.map((x: any) => convertFromYaml(x, dict)));
    return setBaseSchemaProperties(schema, result);
  } else {
    return anyOfS(...schema.map((x: any) => convertFromYaml(x, dict)));
  }
};

function convertFromEnum(yaml: any, _dict: Record<string, Schema>): Schema
{
  const schema = yaml["enum"];
  // testing for the existence of "schema.values" doesn't work
  // because "values" is an array method.
  if (schema.hasOwnProperty("values")) {
    let result = enumS(...schema.values);
    return setBaseSchemaProperties(schema, result);
  } else {
    return enumS(...schema);
  }
};

function convertFromObject(yaml: any, dict: Record<string, Schema>): Schema
{
  const schema = yaml["object"];
  const params: Record<string, any> = {};
  if (schema.properties) {
    params.properties = Object.fromEntries(
      Object.entries(schema.properties)
        .map(([key, value]) => [key, convertFromYaml(value, dict)]));
  }
  if (schema.patternProperties) {
    params.patternProperties = Object.fromEntries(
      Object.entries(schema.properties)
        .map(([key, value]) => [key, convertFromYaml(value, dict)]));
  }
  if (schema.additionalProperties !== undefined) {
    // we special-case `false` here because as a schema, `false` means
    // "accept the value `false`" which is not what we want.
    if (schema.additionalProperties === false) {
      params.additionalProperties = false;
    } else {
      params.additionalProperties = convertFromYaml(
        schema.additionalProperties, dict);
    }
  }
  if (schema["super"]) {
    params.baseSchema = convertFromYaml(schema["super"], dict);
  }
  if (schema["required"] === "all") {
    params.required = Object.keys(schema.properties || {});
  } else if (schema["required"]) {
    params.required = schema["required"];
  }
  if (schema["completions"]) {
    params.completions = schema["completions"];
  }
  
  return setBaseSchemaProperties(schema, objectS(params));
};

function lookup(yaml: any, dict: Record<string, Schema>): Schema
{
  if (dict[yaml.resolveRef] === undefined) {
    throw new Error(`lookup of key ${yaml.resolveRef} failed`);
  }
  return dict[yaml.resolveRef];
}

export function convertFromYaml(yaml: any, dict?: Record<string, Schema>): Schema
{
  dict = dict ?? {};

  // literals
  const literalValues = [
    ["object", objectS()],
    ["path", stringS], // FIXME we should do this one differently to record the autocompletion difference
    ["string", stringS],
    ["number", numberS],
    ["boolean", booleanS],
    [null, nullS],
    // ["null", nullS],
  ];
  for (const [testVal, result] of literalValues) {
    if (yaml === testVal) {
      return result;
    }
  }

  // if the yaml file isn't an object, treat it as a "single-valued enum"
  //
  // NB this doesn't catch all strings. If you want the string "boolean", "path", etc,
  // then you still need to use enum explicitly. This is more useful for singleton
  // numbers and booleans, and only a convenience for (some) strings.
  if (typeof yaml !== "object") {
    return valueSchema(yaml);
  }

  // object key checks:
  interface KV {
    key: string,
    value: (yaml: any, lookup: Record<string, Schema>) => Schema
  }
  const schemaObjectKeyFunctions: KV[] = [
    { key: "anyOf", value: convertFromAnyOf },
    { key: "boolean", value: convertFromBoolean },
    { key: "arrayOf", value: convertFromArrayOf },
    { key: "enum", value: convertFromEnum },
    { key: "maybeArrayOf", value: convertFromMaybeArrayOf },
    { key: "null", value: convertFromNull },
    { key: "number", value: convertFromNumber },
    { key: "object", value: convertFromObject },
    { key: "oneOf", value: convertFromOneOf },
    { key: "path", value: convertFromPath },
    { key: "ref", value: convertFromRef },
    { key: "resolveRef", value: lookup },
    { key: "string", value: convertFromString },
  ];
  for (const { key: objectKey, value: fun } of schemaObjectKeyFunctions) {
    try {
      if (yaml[objectKey as string] !== undefined) {
        return fun(yaml, dict);
      }
    } catch (e) {
      error({yaml});
      throw e;
    }
  }

  error(JSON.stringify(yaml, null, 2));
  throw new Error("Internal Error: Cannot convert object; this should have failed validation.");
}

export function convertFromYAMLString(src: string)
{
  const yaml = readAnnotatedYamlFromString(src);
  
  return convertFromYaml(yaml, {});
}
