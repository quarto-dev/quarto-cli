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

import { getFrontMatterFormatSchema } from "./front-matter.ts";

import { getFormatSchema } from "./format-schemas.ts";
import { pandocOutputFormats } from "./pandoc-output-formats.ts";

import { schemaPath, cacheSchemaFunction } from "./utils.ts";

export async function makeProjectConfigFieldsSchema() {
  const result = objectSchemaFromFieldsFile(
    schemaPath("new/project.yml")
  );
  return result;
}

export const getProjectConfigFieldsSchema = cacheSchemaFunction(
  "project-config-fields",
  makeProjectConfigFieldsSchema
);

export async function makeProjectConfigSchema()
{
  const projectConfigFields = await getProjectConfigFieldsSchema();
  const execute = getFormatExecuteOptionsSchema();
  // const formatExecuteGlobalOptions = getFormatExecuteGlobalOptionsSchema();
  // const formatExecuteCellOptions = getFormatExecuteCellOptionsSchema();
  // FIXME!!
  const format = await getFrontMatterFormatSchema();

  return withId(
    allOfS(
      objectS({
        properties: {
          execute,
          format,
          //
          // NOTE: we are temporarily disabling format validation
          // because it's way too strict
        },
        description: "be a Quarto YAML front matter object",
      }),
      execute,
      format,
      projectConfigFields,
    ),
    "project-config"
  );
}

export const getProjectConfigSchema = cacheSchemaFunction(
  "project-config",
  makeProjectConfigSchema
);
