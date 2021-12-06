/*
* front-matter.ts
*
* JSON Schema for Quarto's YAML frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  describeSchema,
  enumSchema as enumS,
  idSchema as withId,
  NullSchema as nullS,
  objectSchema as objectS,
  oneOfSchema as oneOfS,
  anyOfSchema as anyOfS,
  StringSchema as StringS,
  regexSchema as regexS,
  completeSchema
} from "./common.ts";

import {
  Schema,
  normalizeSchema
} from "../lib/schema.ts";

import { getFormatExecuteOptionsSchema } from "./execute.ts";
import { getFormatSchema } from "./format-schemas.ts";
import { pandocOutputFormats } from "./pandoc-output-formats.ts";

export async function getHtmlFormatSchema()
{
  return objectS({
    properties: {
      "html": await getFormatSchema("html"),
    },
    description: "be an HTML format object",
  });
}

const schemaCache: Record<string, Schema> = {};
const schemaCacheNormalized: Record<string, Schema> = {};

function cacheSchemaFunction(name: string, maker: () => Promise<Schema>):
((normalized?: boolean) => Promise<Schema>)
{
  const getter = async (normalized?: boolean) => {
    if (normalized) {
      if (schemaCacheNormalized[name]) {
        return schemaCacheNormalized[name];
      }
      const schema = await getter();
      schemaCacheNormalized[name] = normalizeSchema(schema);
      return schemaCacheNormalized[name];
    } else {
      if (schemaCache[name]) {
        return schemaCache[name];
      }
      const schema = await maker();
      schemaCache[name] = schema;
      return schema;
    }
  }
  return getter;
}

export async function makeFrontMatterFormatSchema()
{
  const formatSchemaDescriptorList = await Promise.all(
    pandocOutputFormats.map(async (x) => {
      return {
        regex: `^${x}(\\+.+)?$`,
        schema: await getFormatSchema(x),
        name: x
      };
    }));
  const formatSchemas =
    formatSchemaDescriptorList.map(
      ({ regex, schema }) => [regex, schema]);
  const plusFormatStringSchemas =
    formatSchemaDescriptorList.map(
      ({ regex, name }) => completeSchema(
        regexS(regex, `be '${name}'`),
        {
          type: "value",
          display: name,
          suggest_on_accept: true,
          value: name,
          description: name
        }));
  const completionsObject =
    Object.fromEntries(formatSchemaDescriptorList.map(
      ({ name }) => [name, name]));
  
  return oneOfS(
    describeSchema(oneOfS(...plusFormatStringSchemas), "the name of a pandoc-supported output format"),
    regexS("^hugo(\\+.+)?$", "be 'hugo'"),
    objectS({
      patternProperties: Object.fromEntries(formatSchemas),
      completions: completionsObject,
      additionalProperties: false
    })
  );
}
export const getFrontMatterFormatSchema = cacheSchemaFunction(
  "front-matter-format", makeFrontMatterFormatSchema);

export async function makeFrontMatterSchema()
{
  return withId(
    oneOfS(
      nullS,
      objectS({
        properties: {
          title: StringS,
          execute: getFormatExecuteOptionsSchema(),
          format: (await getFrontMatterFormatSchema()),
          //
          // NOTE: we are temporarily disabling format validation
          // because it's way too strict
        },
        description: "be a Quarto YAML front matter object",
      }),
    ),
    "front-matter",
  );
}
export const getFrontMatterSchema = cacheSchemaFunction(
  "front-matter", makeFrontMatterSchema);

