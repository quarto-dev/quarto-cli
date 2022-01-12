/*
* from-yaml.ts
*
* Functions to convert YAML to JSON Schema
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { readAnnotatedYamlFromString } from "./annotated-yaml.ts";

import { globToRegExp } from "path/glob.ts";

import { error } from "log/mod.ts"
import { basename } from "path/mod.ts";
import { readYaml } from "../yaml.ts";

import { expandGlobSync } from "fs/expand_glob.ts";

import { resourcePath } from "../resources.ts";

import {
  Schema,
  getSchemaDefinition,
  setSchemaDefinition,
  hasSchemaDefinition
} from "../lib/schema.ts";

import {
  withValidator
} from "../lib/validator-queue.ts";

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
  regexSchema,
  tagSchema
} from "./common.ts";

import { schemaPath } from "./utils.ts";

import { memoize } from "../memoize.ts";

function setBaseSchemaProperties(yaml: any, schema: Schema): Schema
{
  if (yaml.additionalCompletions)
    schema = completeSchema(schema, ...yaml.additionalCompletions);
  if (yaml.completions)
    schema = completeSchemaOverwrite(schema, ...yaml.completions);
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

function convertFromPattern(yaml: any): Schema
{
  yaml = yaml["pattern"];
  if (typeof yaml === "string") {
    return regexSchema(yaml);
  } else {
    const schema = regexSchema(yaml.regex);
    return setBaseSchemaProperties(yaml, schema);
  }
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
  return refS(yaml.ref, yaml.description || `be ${yaml.ref}`);
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
  if (!hasSchemaDefinition(yaml.resolveRef)) {
    throw new Error(`lookup of key ${yaml.resolveRef} in definitions failed`);
  }
  return getSchemaDefinition(yaml.resolveRef);
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
    { key: "pattern", value: convertFromPattern },
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

export function objectSchemaFromFieldsFile(
  file: string,
  exclude?: (key: string) => boolean): Schema
{
  exclude = exclude ?? ((key: string) => false);
  let properties: Record<string, Schema> = {};
  const global = readYaml(file) as any[];
  
  convertFromFieldsObject(global, properties);
  for (const key of Object.keys(properties)) {
    if (exclude(key)) {
      delete properties[key];
    }
  }
  
  return objectS({ properties });
}

export interface SchemaField {
  name: string;
  schema: Schema;
  hidden?: boolean;
  // deno-lint-ignore no-explicit-any
  "default"?: any;
  alias?: string;
  disabled?: string[];
  enabled?: string[];
  description: string | {
    short: string;
    long: string;
  };
  // deno-lint-ignore no-explicit-any
  tags?: Record<string, any>;
};

export function objectSchemaFromGlob(
  glob: string,
  exclude?: (key: string) => boolean): Schema
{
  exclude = exclude ?? ((key: string) => false);
  let properties: Record<string, Schema> = {};
  for (const { path } of expandGlobSync(glob)) {
    convertFromFieldsObject(readYaml(path) as SchemaField[], properties);
  }
  for (const key of Object.keys(properties)) {
    if (exclude(key)) {
      delete properties[key];
    }
  }
  return objectS({ properties });
}

function annotateSchemaFromField(field: SchemaField, schema: Schema): Schema
{
  if (field.alias) {
    schema = completeSchemaOverwrite(schema);
  }
  if (field.enabled !== undefined) {
    schema = tagSchema(schema, {
      formats: field.enabled
    });
  }
  if (field.disabled !== undefined) {
    schema = tagSchema(schema, {
      formats: (field.disabled as string[]).map(x => `!${x}`)
    });
  }
  if (field.tags) {
    schema = tagSchema(schema, field.tags)
  }
  if (field.description) {
    if (typeof field.description === "string") {
      schema = documentSchema(schema, field.description);
    } else if (typeof field.description === "object") {
      schema = documentSchema(schema, field.description.short);
    }
  }
  return schema;
}

export function schemaFromField(entry: SchemaField): Schema {
  let schema = convertFromYaml(entry.schema);
  return annotateSchemaFromField(entry, schema);
}

export function convertFromFieldsObject(yaml: SchemaField[], obj?: Record<string, Schema>): Record<string, Schema>
{
  const result = obj ?? {};

  for (const field of yaml) {
    let schema = convertFromYaml(field.schema);
    schema = annotateSchemaFromField(field, schema);
    result[field.name] = schema;
  }

  return result;
}

interface SchemaFieldIdDescriptor {
  schemaId: string,
  field: SchemaField
}

export function schemaFieldsFromGlob(
  globPath: string,
  testFun?: (entry: SchemaField, path: string) => boolean
): SchemaFieldIdDescriptor[]
{
  const result = [];
  testFun = testFun ?? ((_e, _p) => true);
  for (const file of expandGlobSync(globPath)) {
    for (const field of readYaml(file.path) as SchemaField[]) {
      const fieldName = field.name;
      const schemaId = `quarto-resource-${file.name.slice(0, -4)}-${fieldName}`;
      if (testFun(field, file.path)) {
        result.push({
          schemaId,
          field
        })
      }
    }
  }
  return result;
}


export const schemaRefContexts = memoize(() => {
  const groups = readYaml(schemaPath("groups.yml")) as Record<string, Record<string, Record<string, string>>>;
  const result = [];
  
  for (const [topLevel, sub] of Object.entries(groups)) {
    for (const key of Object.keys(sub)) {
      result.push(`${topLevel}-${key}`);
    }
  }
  return result;
}, () => "const") as (() => Schema);

export function objectRefSchemaFromContextGlob(
  contextGlob: string,
  testFun?: (field: SchemaField, path: string) => boolean
): Schema
{
  let regexp = globToRegExp(contextGlob);
  let contexts = schemaRefContexts();

  // Why is typescript thinking that testFun can be undefined
  // after the expression below?
  //
  // testFun = testFun ?? ((_field, _path) => true);
  return objectRefSchemaFromGlob(
    schemaPath("{document,cell}-*.yml"),
    (field: SchemaField, path: string) => {
      if (testFun !== undefined && !testFun(field, path)) {
        return false;
      }
      
      let pathContext = basename(path, ".yml");
      let schemaContexts = ((field?.tags?.contexts || []) as string[]);
      
      if (pathContext.match(regexp)) {
        return true;
      }
      return schemaContexts.some(c => c.match(regexp));
    });
}

export function objectRefSchemaFromGlob(
  glob: string,
  testFun?: (field: SchemaField, path: string) => boolean): Schema
{
  const properties: Record<string, Schema> = {};

  for (const { schemaId, field } of schemaFieldsFromGlob(glob, testFun)) {
    let schema = refS(schemaId, schemaId); // FIXME this is a bad description
    properties[field.name] = schema;
  }
  return objectS({ properties });
}

export async function buildSchemaResources()
{
  const path = schemaPath("{cell-*,document-*,project}.yml");
  const result = {};
  // precompile all of the field schemas
  for (const file of expandGlobSync(path)) {
    const yaml = readYaml(file.path) as SchemaField[];
    const entries = Object.entries(convertFromFieldsObject(yaml));
    for (const [fieldName, fieldSchema] of entries) {
      // FIXME this id has to be defined consistently with schemaFieldsFromGlob.
      // It's a footgun.
      const schemaId = `quarto-resource-${file.name.slice(0, -4)}-${fieldName}`;
      const schema = withId(fieldSchema, schemaId);
      await withValidator(schema, async (_validator) => {
        setSchemaDefinition(schema);
      });
    }
  }
}
