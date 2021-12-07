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
  idSchema as withId,
  NullSchema as nullS,
  objectSchema as objectS,
  oneOfSchema as oneOfS,
  regexSchema as regexS,
} from "./common.ts";

import { schemaPath } from "./utils.ts";

import { objectSchemaFromFieldsFile } from "./from-yaml.ts";

import { normalizeSchema, Schema } from "../lib/schema.ts";

import {
  getFormatExecuteCellOptionsSchema,
  getFormatExecuteGlobalOptionsSchema,
  getFormatExecuteOptionsSchema,
} from "./execute.ts";

import { getFormatSchema } from "./format-schemas.ts";
import { pandocOutputFormats } from "./pandoc-output-formats.ts";
import { cacheSchemaFunction } from "./utils.ts";

export const getFormatPandocSchema = cacheSchemaFunction(
  "format-pandoc",
  async () => objectSchemaFromFieldsFile(schemaPath("format-pandoc.yml"))
);

export async function makeFrontMatterFormatSchema() {
  const formatSchemaDescriptorList = await Promise.all(
    pandocOutputFormats.map(async (x) => {
      return {
        regex: `^${x}(\\+.+)?$`,
        schema: allOfS(
          await getFormatSchema(x),
          await getFormatPandocSchema()),
        name: x,
      };
    }),
  );
  const formatSchemas = formatSchemaDescriptorList.map(
    ({ regex, schema }) => [regex, schema],
  );
  const plusFormatStringSchemas = formatSchemaDescriptorList.map(
    ({ regex, name }) =>
      completeSchema(
        regexS(regex, `be '${name}'`),
        {
          type: "value",
          display: name,
          suggest_on_accept: true,
          value: name,
          description: name,
        },
      ),
  );
  const completionsObject = Object.fromEntries(formatSchemaDescriptorList.map(
    ({ name }) => [name, name],
  ));

  return oneOfS(
    describeSchema(
      oneOfS(...plusFormatStringSchemas),
      "the name of a pandoc-supported output format",
    ),
    regexS("^hugo(\\+.+)?$", "be 'hugo'"),
    allOfS(
      objectS({
        patternProperties: Object.fromEntries(formatSchemas),
        completions: completionsObject,
        additionalProperties: false,
      }),
    ),
  );
}
export const getFrontMatterFormatSchema = cacheSchemaFunction(
  "front-matter-format",
  makeFrontMatterFormatSchema,
);

export async function makeFrontMatterSchema() {
  return withId(
    oneOfS(
      nullS,
      allOfS(
        objectS({
          properties: {
            execute: getFormatExecuteOptionsSchema(),
            format: (await getFrontMatterFormatSchema()),
            //
            // NOTE: we are temporarily disabling format validation
            // because it's way too strict
          },
          description: "be a Quarto YAML front matter object",
        }),
        objectSchemaFromFieldsFile(
          schemaPath("format-metadata.yml"),
          key => key === "format",
        ),
        objectSchemaFromFieldsFile(
          schemaPath("format-pandoc.yml"),
          key => key === "format",
        ),
        getFormatExecuteGlobalOptionsSchema(),
        getFormatExecuteCellOptionsSchema(),
      ),
    ),
    "front-matter",
  );
}
export const getFrontMatterSchema = cacheSchemaFunction(
  "front-matter",
  makeFrontMatterSchema,
);
