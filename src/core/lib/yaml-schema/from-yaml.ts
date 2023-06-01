/*
 * from-yaml.ts
 *
 * Functions to convert YAML to JSON Schema
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import {
  getSchemaDefinition,
  hasSchemaDefinition,
  setSchemaDefinition,
} from "../yaml-validation/schema.ts";

import { withValidator } from "../yaml-validation/validator-queue.ts";

import {
  booleanSchema as booleanS,
  nullSchema as nullS,
  numberSchema as numberS,
  stringSchema as stringS,
} from "./constants.ts";

import {
  allOfSchema as allOfS,
  anyOfSchema as anyOfS,
  anySchema as anyS,
  arraySchema as arrayOfS,
  completeSchema,
  completeSchemaOverwrite,
  documentSchema,
  enumSchema as enumS,
  idSchema as withId,
  objectSchema as objectS,
  refSchema as refS,
  regexSchema,
  tagSchema,
  valueSchema,
} from "./common.ts";

import { memoize } from "../memoize.ts";

import { ConcreteSchema } from "./types.ts";
import {
  expandResourceGlob,
  getYamlIntelligenceResource,
} from "../yaml-intelligence/resources.ts";
import { globToRegExp } from "../glob.ts";
import { fromEntries } from "../polyfills.ts";
import { asMappedString, EitherString } from "../mapped-text.ts";
import {
  readAndValidateYamlFromMappedString,
  ValidationError,
} from "./validated-yaml.ts";

import { Schema } from "../yaml-schema/types.ts";
import { InternalError } from "../error.ts";

function setBaseSchemaProperties(
  // deno-lint-ignore no-explicit-any
  yaml: any,
  schema: ConcreteSchema,
): ConcreteSchema {
  if (yaml.additionalCompletions) {
    schema = completeSchema(schema, ...yaml.additionalCompletions);
  }
  if (yaml.completions) {
    schema = completeSchemaOverwrite(schema, ...yaml.completions);
  }
  if (yaml.id) {
    schema = withId(schema, yaml.id);
  }
  if (yaml.hidden === true) {
    // don't complete anything through a `hidden` field
    schema = completeSchemaOverwrite(schema);
    schema = tagSchema(schema, {
      "hidden": true,
    });
  }
  if (yaml.tags) {
    schema = tagSchema(schema, yaml.tags);
  }

  // FIXME in YAML schema, we call it description
  // in the JSON objects, we call that "documentation"
  if (yaml.description) {
    schema = tagSchema(schema, { description: yaml.description });
    if (typeof yaml.description === "string") {
      schema = documentSchema(schema, yaml.description);
    } else if (typeof yaml.description === "object") {
      schema = documentSchema(schema, yaml.description.short);
    }
  }

  // make shallow copy so that downstream can assign to it
  const result = Object.assign({}, schema);

  if (yaml.errorDescription) {
    result.description = yaml.errorDescription;
  }

  if (yaml.errorMessage) {
    result.errorMessage = yaml.errorMessage;
  }

  return result;
}

// deno-lint-ignore no-explicit-any
function convertFromNull(yaml: any): ConcreteSchema {
  return setBaseSchemaProperties(yaml["null"], nullS);
}

// deno-lint-ignore no-explicit-any
function convertFromSchema(yaml: any): ConcreteSchema {
  const schema = convertFromYaml(yaml.schema);
  return setBaseSchemaProperties(yaml, schema);
}

// TODO we accept "string: pattern:" and "pattern: string:"
//      that seems yucky.
//
// deno-lint-ignore no-explicit-any
function convertFromString(yaml: any): ConcreteSchema {
  if (yaml["string"].pattern) {
    return setBaseSchemaProperties(
      yaml,
      setBaseSchemaProperties(
        yaml["string"],
        regexSchema(yaml["string"].pattern),
      ),
    );
  } else {
    return setBaseSchemaProperties(
      yaml,
      setBaseSchemaProperties(
        yaml["string"],
        stringS,
      ),
    );
  }
}

// deno-lint-ignore no-explicit-any
function convertFromPattern(yaml: any): ConcreteSchema {
  if (typeof yaml.pattern === "string") {
    return setBaseSchemaProperties(yaml, regexSchema(yaml.pattern));
  } else {
    return setBaseSchemaProperties(
      yaml,
      setBaseSchemaProperties(yaml.pattern, regexSchema(yaml.pattern.regex)),
    );
  }
}

// deno-lint-ignore no-explicit-any
function convertFromPath(yaml: any): ConcreteSchema {
  return setBaseSchemaProperties(yaml["path"], stringS);
}

// deno-lint-ignore no-explicit-any
function convertFromNumber(yaml: any): ConcreteSchema {
  return setBaseSchemaProperties(yaml["number"], numberS);
}

// deno-lint-ignore no-explicit-any
function convertFromBoolean(yaml: any): ConcreteSchema {
  return setBaseSchemaProperties(yaml["boolean"], booleanS);
}

// deno-lint-ignore no-explicit-any
function convertFromRef(yaml: any): ConcreteSchema {
  return setBaseSchemaProperties(yaml, refS(yaml.ref, `be ${yaml.ref}`));
}

// deno-lint-ignore no-explicit-any
function convertFromMaybeArrayOf(yaml: any): ConcreteSchema {
  const inner = convertFromYaml(yaml.maybeArrayOf);
  const schema = tagSchema(
    anyOfS(inner, arrayOfS(inner)),
    {
      "complete-from": ["anyOf", 0], // complete from `schema` completions, ignoring arrayOf
    },
  );

  return setBaseSchemaProperties(yaml, schema);
}

// deno-lint-ignore no-explicit-any
function convertFromArrayOf(yaml: any): ConcreteSchema {
  if (yaml.arrayOf.schema) {
    const result = arrayOfS(convertFromYaml(yaml.arrayOf.schema));
    return setBaseSchemaProperties(
      yaml,
      setBaseSchemaProperties(yaml.arrayOf, result),
    );
  } else {
    return setBaseSchemaProperties(
      yaml,
      arrayOfS(convertFromYaml(yaml.arrayOf)),
    );
  }
}

// deno-lint-ignore no-explicit-any
function convertFromAllOf(yaml: any): ConcreteSchema {
  if (yaml.allOf.schemas) {
    // deno-lint-ignore no-explicit-any
    const inner = yaml.allOf.schemas.map((x: any) => convertFromYaml(x));
    const schema = allOfS(...inner);
    return setBaseSchemaProperties(
      yaml,
      setBaseSchemaProperties(yaml.allOf, schema),
    );
  } else {
    // deno-lint-ignore no-explicit-any
    const inner = yaml.allOf.map((x: any) => convertFromYaml(x));
    const schema = allOfS(...inner);
    return setBaseSchemaProperties(yaml, schema);
  }
}

// deno-lint-ignore no-explicit-any
function convertFromAnyOf(yaml: any): ConcreteSchema {
  if (yaml.anyOf.schemas) {
    // deno-lint-ignore no-explicit-any
    const inner = yaml.anyOf.schemas.map((x: any) => convertFromYaml(x));
    const schema = anyOfS(...inner);
    return setBaseSchemaProperties(
      yaml,
      setBaseSchemaProperties(yaml.anyOf, schema),
    );
  } else {
    // deno-lint-ignore no-explicit-any
    const inner = yaml.anyOf.map((x: any) => convertFromYaml(x));
    const schema = anyOfS(...inner);
    return setBaseSchemaProperties(yaml, schema);
  }
}

// deno-lint-ignore no-explicit-any
function convertFromEnum(yaml: any): ConcreteSchema {
  const schema = yaml["enum"];
  // testing for the existence of "schema.values" doesn't work
  // because "values" is an array method.
  // deno-lint-ignore no-prototype-builtins
  if (schema.hasOwnProperty("values")) {
    return setBaseSchemaProperties(
      yaml,
      setBaseSchemaProperties(yaml["enum"], enumS(...schema.values)),
    );
  } else {
    return setBaseSchemaProperties(yaml, enumS(...schema));
  }
}

// deno-lint-ignore no-explicit-any
function convertFromRecord(yaml: any): ConcreteSchema {
  if (yaml.record.properties) {
    const schema = convertFromObject({
      "object": {
        "properties": yaml.record.properties,
        "closed": true,
        "required": "all",
      },
    });
    return setBaseSchemaProperties(
      yaml,
      setBaseSchemaProperties(yaml.record, schema),
    );
  } else {
    const schema = convertFromObject({
      "object": {
        "properties": yaml.record,
        "closed": true,
        "required": "all",
      },
    });
    return setBaseSchemaProperties(yaml, schema);
  }
}

// deno-lint-ignore no-explicit-any
function convertFromObject(yaml: any): ConcreteSchema {
  const schema = yaml["object"];
  // deno-lint-ignore no-explicit-any
  const params: Record<string, any> = {};
  if (schema.namingConvention && typeof schema.namingConvention === "string") {
    switch (schema.namingConvention) {
      case "ignore":
        params.namingConvention = "ignore";
        break;

      case "capitalizationCase":
        params.namingConvention = "capitalizationCase";
        break;
      case "capitalization-case":
        params.namingConvention = "capitalizationCase";
        break;
      case "capitalization_case":
        params.namingConvention = "capitalizationCase";
        break;

      case "underscoreCase":
        params.namingConvention = "underscore_case";
        break;
      case "underscore-case":
        params.namingConvention = "underscore_case";
        break;
      case "underscore_case":
        params.namingConvention = "underscore_case";
        break;

      case "dashCase":
        params.namingConvention = "dash-case";
        break;
      case "dash-case":
        params.namingConvention = "dash-case";
        break;
      case "dash_case":
        params.namingConvention = "dash-case";
        break;

      case "camelCase":
        params.namingConvention = "capitalizationCase";
        break;
      case "camel-case":
        params.namingConvention = "capitalizationCase";
        break;
      case "camel_case":
        params.namingConvention = "capitalizationCase";
        break;

      case "snakeCase":
        params.namingConvention = "underscore_case";
        break;
      case "snake-case":
        params.namingConvention = "underscore_case";
        break;
      case "snake_case":
        params.namingConvention = "underscore_case";
        break;

      case "kebabCase":
        params.namingConvention = "dash-case";
        break;
      case "kebab-case":
        params.namingConvention = "dash-case";
        break;
      case "kebab_case":
        params.namingConvention = "dash-case";
        break;
      default:
        throw new InternalError(
          `Unrecognized naming convention ${schema.namingConvention} should have failed validation`,
        );
    }
  } else {
    params.namingConvention = schema.namingConvention;
  }
  if (schema.properties) {
    params.properties = fromEntries(
      Object.entries(schema.properties)
        .map(([key, value]) => [key, convertFromYaml(value)]),
    );
  }
  if (schema.patternProperties) {
    params.patternProperties = fromEntries(
      Object.entries(schema.properties)
        .map(([key, value]) => [key, convertFromYaml(value)]),
    );
  }
  if (schema.propertyNames !== undefined) {
    params.propertyNames = convertFromYaml(schema.propertyNames);
  } else if (schema.closed === true) {
    const objectKeys = Object.keys(params.properties || {});
    if (objectKeys.length === 0) {
      throw new Error("object schema `closed` requires field `properties`.");
    }
    // closed schemas provide all the information
    // about the keyspace that is needed. They also interact badly with
    // namingConvention detection or declaration, so we disallow that.
    if (
      params.namingConvention !== undefined &&
      params.namingConvention !== "ignore"
    ) {
      throw new Error(
        "object schema `closed` is only supported with namingConvention: `ignore`",
      );
    }
    params.namingConvention = "ignore";

    // params.propertyNames = enumS(...objectKeys);
    params.closed = true;
  }
  if (schema.additionalProperties !== undefined) {
    // we special-case `false` here because as a schema, `false` means
    // "accept the value `false`" which is not what we want.
    if (schema.additionalProperties === false) {
      params.additionalProperties = false;
    } else {
      params.additionalProperties = convertFromYaml(
        schema.additionalProperties,
      );
    }
  }
  if (schema["super"]) {
    if (Array.isArray(schema["super"])) {
      params.baseSchema = schema["super"].map((s) => convertFromYaml(s));
    } else {
      params.baseSchema = convertFromYaml(schema["super"]);
    }
  }
  if (schema["required"] === "all") {
    params.required = Object.keys(schema.properties || {});
  } else if (schema["required"]) {
    params.required = schema["required"];
  }
  if (schema["completions"]) {
    params.completions = schema["completions"];
  }

  return setBaseSchemaProperties(
    yaml,
    setBaseSchemaProperties(schema, objectS(params)),
  );
}

// deno-lint-ignore no-explicit-any
function lookup(yaml: any): ConcreteSchema {
  if (!hasSchemaDefinition(yaml.resolveRef)) {
    throw new Error(`lookup of key ${yaml.resolveRef} in definitions failed`);
  }
  return getSchemaDefinition(yaml.resolveRef)!;
}

let schemaSchema: ConcreteSchema | undefined = undefined;
export async function schemaFromString(
  str: EitherString,
): Promise<ConcreteSchema> {
  const mappedStr = asMappedString(str);

  if (schemaSchema === undefined) {
    schemaSchema = getSchemaSchemas()["schema/schema"] as ConcreteSchema; // this registers the schema schema
  }

  const { yaml, yamlValidationErrors } =
    await readAndValidateYamlFromMappedString(mappedStr, schemaSchema);
  if (yamlValidationErrors.length) {
    throw new ValidationError("from-yaml", yamlValidationErrors);
  }
  return convertFromYaml(yaml);
}

// deno-lint-ignore no-explicit-any
export function convertFromYaml(yaml: any): ConcreteSchema {
  // literals
  const literalValues = [
    { val: "object", schema: objectS() },
    { val: "path", schema: stringS }, // FIXME we should treat this one differently to record the autocompletion difference
    { val: "string", schema: stringS },
    { val: "number", schema: numberS },
    { val: "boolean", schema: booleanS },
    { val: "any", schema: anyS() },
    { val: null, schema: nullS },
  ];
  for (const { val, schema } of literalValues) {
    if (yaml === val) {
      return schema;
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
    key: string;
    // deno-lint-ignore no-explicit-any
    value: (yaml: any) => ConcreteSchema;
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
    { key: "path", value: convertFromPath },
    { key: "record", value: convertFromRecord },
    { key: "ref", value: convertFromRef },
    { key: "resolveRef", value: lookup },
    { key: "string", value: convertFromString },
    { key: "pattern", value: convertFromPattern },
    { key: "schema", value: convertFromSchema },
  ];
  for (const { key: objectKey, value: fun } of schemaObjectKeyFunctions) {
    if (yaml[objectKey as string] !== undefined) {
      return fun(yaml);
    }
  }
  throw new InternalError(
    "Cannot convert object; this should have failed validation.",
  );
}

export function objectSchemaFromFieldsObject(
  fields: SchemaField[],
  exclude?: (key: string) => boolean,
): ConcreteSchema {
  exclude = exclude || ((_key: string) => false);
  const properties: Record<string, ConcreteSchema> = {};

  convertFromFieldsObject(fields, properties);
  for (const key of Object.keys(properties)) {
    if (exclude(key)) {
      delete properties[key];
    }
  }

  return objectS({ properties });
}

export interface SchemaField {
  name: string;
  schema: ConcreteSchema;
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
}

export function objectSchemaFromGlob(
  glob: string,
  exclude?: (key: string) => boolean,
): ConcreteSchema {
  exclude = exclude || ((_key: string) => false);
  const properties: Record<string, ConcreteSchema> = {};
  for (const [_path, fields] of expandResourceGlob(glob)) {
    convertFromFieldsObject(fields as SchemaField[], properties);
  }
  for (const key of Object.keys(properties)) {
    if (exclude(key)) {
      delete properties[key];
    }
  }
  return objectS({ properties });
}

function annotateSchemaFromField(
  field: SchemaField,
  schema: ConcreteSchema,
): ConcreteSchema {
  if (field.enabled !== undefined) {
    schema = tagSchema(schema, {
      formats: field.enabled,
    });
  }
  if (field.disabled !== undefined) {
    schema = tagSchema(schema, {
      formats: (field.disabled as string[]).map((x) => `!${x}`),
    });
  }
  if (field.tags) {
    schema = tagSchema(schema, field.tags);
  }
  if (field.description) {
    if (typeof field.description === "string") {
      schema = documentSchema(schema, field.description);
    } else if (typeof field.description === "object") {
      schema = documentSchema(schema, field.description.short);
    }
    schema = tagSchema(schema, {
      description: field.description,
    });
  }
  if (field.hidden) {
    schema = tagSchema(schema, {
      "hidden": true,
    });
  }
  return schema;
}

export function schemaFromField(entry: SchemaField): ConcreteSchema {
  const schema = convertFromYaml(entry.schema);
  return annotateSchemaFromField(entry, schema);
}

export function convertFromFieldsObject(
  yaml: SchemaField[],
  obj?: Record<string, ConcreteSchema>,
): Record<string, ConcreteSchema> {
  const result = obj || {};

  for (const field of yaml) {
    let schema = convertFromYaml(field.schema);
    schema = annotateSchemaFromField(field, schema);
    result[field.name] = schema;
    if (field.alias) {
      result[field.alias] = schema;
    }
  }

  return result;
}

interface SchemaFieldIdDescriptor {
  schemaId: string;
  field: SchemaField;
}

export function schemaFieldsFromGlob(
  globPath: string,
  testFun?: (entry: SchemaField, path: string) => boolean,
): SchemaFieldIdDescriptor[] {
  const result = [];
  testFun = testFun || ((_e, _p) => true);
  for (const [file, fields] of expandResourceGlob(globPath)) {
    for (const field of (fields as SchemaField[])) {
      const fieldName = field.name;
      const schemaId = `quarto-resource-${
        file.split("/").slice(-1)[0].slice(0, -4)
      }-${fieldName}`;
      if (testFun(field, file)) {
        result.push({
          schemaId,
          field,
        });
      }
    }
  }
  return result;
}

export const schemaRefContexts = memoize(() => {
  const groups = getYamlIntelligenceResource("schema/groups.yml") as Record<
    string,
    Record<string, Record<string, string>>
  >;
  const result = [];

  for (const [topLevel, sub] of Object.entries(groups)) {
    for (const key of Object.keys(sub)) {
      result.push(`${topLevel}-${key}`);
    }
  }
  return result;
}, () => "const") as (() => ConcreteSchema);

export function objectRefSchemaFromContextGlob(
  contextGlob: string,
  testFun?: (field: SchemaField, path: string) => boolean,
): ConcreteSchema {
  const regexp = globToRegExp(contextGlob);

  // Why is typescript thinking that testFun can be undefined
  // after the expression below?
  //
  // testFun = testFun || ((_field, _path) => true);
  return objectRefSchemaFromGlob(
    "schema/{document,cell}-*.yml",
    (field: SchemaField, path: string) => {
      if (testFun !== undefined && !testFun(field, path)) {
        return false;
      }

      // this is 'basename(path, ".yml")', but I don't want to pull the whole import
      // + os dependency into /lib
      const pathContext = path.split("/").slice(-1)[0].slice(0, -4);
      const schemaContexts = ((field !== undefined &&
        field.tags !== undefined &&
        field.tags.contexts) || []) as string[];

      if (pathContext.match(regexp)) {
        return true;
      }
      return schemaContexts.some((c) => c.match(regexp));
    },
  );
}

export function objectRefSchemaFromGlob(
  glob: string,
  testFun?: (field: SchemaField, path: string) => boolean,
): ConcreteSchema {
  const properties: Record<string, ConcreteSchema> = {};

  for (const { schemaId, field } of schemaFieldsFromGlob(glob, testFun)) {
    const schema = refS(schemaId, schemaId); // FIXME this is a bad description
    properties[field.name] = schema;
    if (field.alias) {
      properties[field.alias] = schema;
    }
  }
  return objectS({ properties });
}

export async function buildResourceSchemas() {
  const path = "schema/{cell-*,document-*,project}.yml";
  // precompile all of the field schemas
  for (const [file, fields] of expandResourceGlob(path)) {
    const yaml = fields as SchemaField[];
    const entries = Object.entries(convertFromFieldsObject(yaml));
    for (const [fieldName, fieldSchema] of entries) {
      // TODO this id has to be defined consistently with schemaFieldsFromGlob.
      // It's a footgun.
      const schemaId = `quarto-resource-${
        file.split("/").slice(-1)[0].slice(0, -4)
      }-${fieldName}`;
      const schema = withId(fieldSchema, schemaId);
      setSchemaDefinition(schema);
      await withValidator(schema, async (_validator) => {
      });
    }
  }
}

export function getSchemaSchemas(): Record<string, Schema> {
  const yaml = getYamlIntelligenceResource("schema/schema.yml") as Record<
    string,
    // deno-lint-ignore no-explicit-any
    any
  >[];
  const dict: Record<string, Schema> = {};
  for (const obj of yaml) {
    const schema = convertFromYaml(obj) as ConcreteSchema;
    setSchemaDefinition(schema);
    dict[schema.$id!] = schema;
  }
  return dict;
}
