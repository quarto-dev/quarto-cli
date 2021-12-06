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

import { readYaml } from "../yaml.ts";

import {
  Schema,
  getSchemaDefinition
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
  allOfSchema as allOfS,
  enumSchema as enumS,
  documentSchema,
  completeSchema,
  completeSchemaOverwrite,
  valueSchema,
  regexSchema
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
  
  // make shallow copy so that downstream can assign to it
  const result = Object.assign({}, schema);
  
  return result;
}

function convertFromNull(yaml: any): Schema
{
  return setBaseSchemaProperties(yaml["null"], nullS);
}

function convertFromSchema(yaml: any): Schema
{
  const schema = convertFromYaml(yaml.schema);
  return setBaseSchemaProperties(yaml, schema);
}

function convertFromString(yaml: any): Schema
{
  yaml = yaml["string"];
  const schema = yaml.pattern ? regexSchema(yaml.pattern) : stringS;
  return setBaseSchemaProperties(yaml, schema);
}

function convertFromPath(yaml: any): Schema
{
  return setBaseSchemaProperties(yaml["path"], stringS);
}

function convertFromNumber(yaml: any): Schema
{
  return setBaseSchemaProperties(yaml["number"], numberS);
}

function convertFromBoolean(yaml: any): Schema
{
  return setBaseSchemaProperties(yaml["boolean"], booleanS);
}

function convertFromRef(yaml: any): Schema
{
  return refS(yaml.ref, yaml.description || "");
}

function convertFromMaybeArrayOf(yaml: any): Schema
{
  const schema = convertFromYaml(yaml.maybeArrayOf);
  return oneOfS(schema, arrayOfS(schema));
};

function convertFromArrayOf(yaml: any): Schema
{
  const schema = yaml.arrayOf;
  if (schema.schema) {
    let result = arrayOfS(convertFromYaml(schema.schema));
    return setBaseSchemaProperties(schema, result);
  } else {
    return arrayOfS(convertFromYaml(schema));
  }
};

function convertFromOneOf(yaml: any): Schema
{
  const schema = yaml.oneOf;
  if (schema.schemas) {
    let inner = schema.schemas.map((x: any) => convertFromYaml(x));
    let result = oneOfS(...inner);
    return setBaseSchemaProperties(schema, result);
  } else {
    return oneOfS(...schema.map((x: any) => convertFromYaml(x)));
  }
};

function convertFromAllOf(yaml: any): Schema
{
  const schema = yaml.allOf;
  if (schema.schemas) {
    let inner = schema.schemas.map((x: any) => convertFromYaml(x));
    let result = allOfS(...inner);
    return setBaseSchemaProperties(schema, result);
  } else {
    return allOfS(...schema.map((x: any) => convertFromYaml(x)));
  }
};

function convertFromAnyOf(yaml: any): Schema
{
  const schema = yaml.anyOf;
  if (schema.schemas) {
    let result = anyOfS(...schema.schemas.map((x: any) => convertFromYaml(x)));
    return setBaseSchemaProperties(schema, result);
  } else {
    return anyOfS(...schema.map((x: any) => convertFromYaml(x)));
  }
};

function convertFromEnum(yaml: any): Schema
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

function convertFromObject(yaml: any): Schema
{
  const schema = yaml["object"];
  const params: Record<string, any> = {};
  if (schema.properties) {
    params.properties = Object.fromEntries(
      Object.entries(schema.properties)
        .map(([key, value]) => [key, convertFromYaml(value)]));
  }
  if (schema.patternProperties) {
    params.patternProperties = Object.fromEntries(
      Object.entries(schema.properties)
        .map(([key, value]) => [key, convertFromYaml(value)]));
  }
  if (schema.additionalProperties !== undefined) {
    // we special-case `false` here because as a schema, `false` means
    // "accept the value `false`" which is not what we want.
    if (schema.additionalProperties === false) {
      params.additionalProperties = false;
    } else {
      params.additionalProperties = convertFromYaml(
        schema.additionalProperties);
    }
  }
  if (schema["super"]) {
    params.baseSchema = convertFromYaml(schema["super"]);
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

function lookup(yaml: any): Schema
{
  const result = getSchemaDefinition(yaml.resolveRef);
  if (result === undefined) {
    throw new Error(`lookup of key ${yaml.resolveRef} in definitions failed`);
  }
  return result;
}

export function convertFromYaml(yaml: any): Schema
{
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
    value: (yaml: any) => Schema
  }
  const schemaObjectKeyFunctions: KV[] = [
    { key: "anyOf", value: convertFromAnyOf },
    { key: "allOf", value: convertFromAllOf },
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
    { key: "schema", value: convertFromSchema },
  ];
  for (const { key: objectKey, value: fun } of schemaObjectKeyFunctions) {
    try {
      if (yaml[objectKey as string] !== undefined) {
        return fun(yaml);
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
  
  return convertFromYaml(yaml);
}

export function objectSchemaFromFieldsFile(file: string): Schema
{
  const properties: Record<string, Schema> = {};
  const global = readYaml(file) as any[];
  
  convertFromFieldsObject(global, properties);
  return objectS({ properties });
}

export function convertFromFieldsObject(yaml: any[], obj?: Record<string, Schema>): Record<string, Schema>
{
  const result = obj ?? {};

  for (const field of yaml) {
    const schema = convertFromYaml(field.schema);
    result[field.name] = schema;
  }

  return result;
}
