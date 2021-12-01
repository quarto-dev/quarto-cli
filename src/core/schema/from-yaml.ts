/*
* from-yaml.ts
*
* Functions to convert YAML to JSON Schema
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { readAnnotatedYamlFromString } from "./annotated-yaml.ts";

import {
  Schema
} from "../lib/schema.ts";

import {
  idSchema as withId,
  StringSchema as stringS,
  BooleanSchema as booleanS,
  NumberSchema as numberS,
  objectSchema as objectS,
  anySchema as anyS,
  refSchema as refS,
  arraySchema as arrayOfS,
  oneOfSchema as oneOfS,
  anyOfSchema as anyOfS,
  enumSchema as enumS,
  completeSchema,
  completeSchemaOverwrite,
} from "./common.ts";

// const baseSchema = withId(objectS({
//   properties: {
//     id: stringS,
//     completions: arrayOfS(stringS)
//   }
// }), "schema/yaml-schema/base-schema");
// const objectSchema = withId(objectS({
//   baseSchema: baseSchema
//   properties: {
//     required: oneOfS(enumS("all"), arrayOfS(stringS)),
//     "super": refS("schema/yaml-schema/object-schema", "be an object schema object"),
//     hidden: booleanS,
//     additionalProperties: refS("schema/yaml-schema/schema", "be a schema object"),
//     properties: objectS({
//       additionalProperties: refS("schema/yaml-schema/schema", "be a schema object")
//     })
//   },
// }), "schema/yaml-schema/object-schema");
// const enumSchema = withId(objectS({
// }, "schema/yaml-schema/enum-schema"));

function setBaseSchemaProperties(yaml: any, schema: Schema): Schema
{
  if (yaml.additionalCompletions)
    schema = completeSchema(schema, yaml.additionalCompletions);
  if (yaml.completions)
    schema = completeSchemaOverwrite(schema, yaml.completions);
  if (yaml.id)
    schema = withId(schema, yaml.id);
  return schema;
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
  if (schema.additionalProperties) {
    params.additionalProperties = convertFromYaml(
      schema.additionalProperties, dict);
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

export function convertFromYaml(yaml: any, dict: Record<string, Schema>): Schema
{
  // literals
  const literalValues = [
    ["object", objectS()],
    ["string", stringS],
    ["number", numberS],
    ["boolean", booleanS]
  ];
  for (const [testVal, result] of literalValues) {
    if (yaml === testVal) {
      return result;
    }
  }

  // object key checks:
  interface KV {
    key: string,
    value: (yaml: any, lookup: Record<string, Schema>) => Schema
  }
  const schemaObjectKeyFunctions: KV[] = [
    { key: "ref", value: convertFromRef },
    { key: "maybeArrayOf", value: convertFromMaybeArrayOf },
    { key: "arrayOf", value: convertFromArrayOf },
    { key: "oneOf", value: convertFromOneOf },
    { key: "anyOf", value: convertFromAnyOf },
    { key: "enum", value: convertFromEnum },
    { key: "object", value: convertFromObject },
    { key: "resolveRef", value: lookup },
  ];
  for (const { key: objectKey, value: fun } of schemaObjectKeyFunctions) {
    if (yaml[objectKey as string] !== undefined) {
      return fun(yaml, dict);
    }
  }

  throw new Error("Internal Error: Cannot convert object; this should have failed validation.");
}

export function convertFromYAMLString(src: string)
{
  const yaml = readAnnotatedYamlFromString(src);
  
  return convertFromYaml(yaml, {});
}
