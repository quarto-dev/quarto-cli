/*
* front-matter.ts
*
* JSON Schema for Quarto's YAML frontmatter
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  allOfSchema as allOfS,
  completeSchema,
  describeSchema,
  nullSchema as nullS,
  objectSchema as objectS,
  oneOfSchema as oneOfS,
  regexSchema as regexS,
} from "./common.ts";

import { getFormatExecuteOptionsSchema } from "./execute.ts";

import { objectRefSchemaFromContextGlob, SchemaField } from "./from-yaml.ts";

import { getFormatSchema } from "./format-schemas.ts";
import { pandocListFormats } from "../pandoc/pandoc-formats.ts";

import { defineCached } from "./definitions.ts";

import { errorMessageSchema } from "./common.ts";

// deno-lint-ignore require-await
export async function makeFrontMatterFormatSchema(nonStrict = false) {
  const hideFormat = (format: string) => {
    const hideList = ["html", "epub", "docbook"];
    const hidden = hideList.some((h) =>
      format.startsWith(h) &&
      format.length > h.length
    );
    return { name: format, hidden };
  };
  const formatSchemaDescriptorList = (await pandocListFormats()).map(
    (format) => {
      const {
        name,
        hidden,
      } = hideFormat(format);
      return {
        regex: `^${name}(\\+.+)?$`,
        schema: getFormatSchema(name),
        name,
        hidden,
      };
    },
  );
  const formatSchemas = formatSchemaDescriptorList.map(
    ({ regex, schema }) => [regex, schema],
  );
  const plusFormatStringSchemas = formatSchemaDescriptorList.map(
    ({ regex, name, hidden }) => {
      const schema = regexS(regex, `be '${name}'`);
      if (hidden) {
        return schema;
      }
      return completeSchema(schema, name);
    },
  );
  const completionsObject = Object.fromEntries(
    formatSchemaDescriptorList
      .filter(({ hidden }) => !hidden)
      .map(({ name }) => [name, ""]),
  );

  return errorMessageSchema(
    oneOfS(
      describeSchema(
        oneOfS(...plusFormatStringSchemas),
        "the name of a pandoc-supported output format",
      ),
      regexS("^hugo(\\+.+)?$", "be 'hugo'"),
      allOfS(
        objectS({
          patternProperties: Object.fromEntries(formatSchemas),
          completions: completionsObject,
          additionalProperties: nonStrict,
        }),
      ),
    ),
    "${value} is not a valid output format.",
  );
}

export const getFrontMatterFormatSchema = defineCached(
  async () => {
    return {
      schema: await makeFrontMatterFormatSchema(),
      errorHandlers: [],
    };
  },
  "front-matter-format",
);

export const getNonStrictFrontMatterFormatSchema = defineCached(
  async () => {
    return {
      schema: await makeFrontMatterFormatSchema(true),
      errorHandlers: [],
    };
  },
  "front-matter-format-nonstrict",
);

export const getFrontMatterSchema = defineCached(
  async () => {
    const executeObjSchema = await getFormatExecuteOptionsSchema();
    return {
      schema: oneOfS(
        nullS,
        allOfS(
          objectS({
            properties: {
              execute: executeObjSchema,
              format: (await getFrontMatterFormatSchema()),
            },
            description: "be a Quarto YAML front matter object",
          }),
          objectRefSchemaFromContextGlob(
            "document-*",
            (field: SchemaField) => field.name !== "format",
          ),
          executeObjSchema,
        ),
      ),
      errorHandlers: [],
    };
  },
  "front-matter",
);
