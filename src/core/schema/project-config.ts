/*
* project-config.ts
*
* JSON Schema for _quarto.yml, Quarto's project configuration YAML
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

import { objectSchemaFromFieldsFile } from "./from-yaml.ts";

import { normalizeSchema, Schema } from "../lib/schema.ts";

import {
  getFormatExecuteOptionsSchema,
} from "./execute.ts";

import { makeFrontMatterFormatSchema, getFrontMatterFormatSchema } from "./front-matter.ts";

import { getFormatSchema } from "./format-schemas.ts";
import { pandocOutputFormats } from "./pandoc-output-formats.ts";

import { schemaPath } from "./utils.ts";
import { defineCached } from "./definitions.ts";

export const getProjectConfigFieldsSchema = defineCached(
  async () => objectSchemaFromFieldsFile(schemaPath("new/project.yml")),
  "project-config-fields");

export const getProjectConfigSchema = defineCached(
  async () => {
    const projectConfigFields = await getProjectConfigFieldsSchema();
    const execute = await getFormatExecuteOptionsSchema();
    const format = await getFrontMatterFormatSchema();
    const result = allOfS(
      objectS({
        properties: {
          execute,
          format,
          // NOTE: we are temporarily disabling format validation
          // because it's way too strict
        },
        description: "be a Quarto YAML front matter object",
      }),
      execute,
      (await makeFrontMatterFormatSchema(true)), // we must make this nonStrict, see definition
      projectConfigFields,
    );
    return describeSchema(result, "a project configuration object");
  },
  "project-config");

