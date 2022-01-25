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
  describeSchema,
  objectSchema as objectS,
} from "./common.ts";

import { objectSchemaFromFieldsFile } from "./from-yaml.ts";

import { getFormatExecuteOptionsSchema } from "./execute.ts";

import {
  getFrontMatterSchema,
  getFrontMatterFormatSchema,
  makeFrontMatterFormatSchema,
} from "./front-matter.ts";

import { schemaPath } from "./utils.ts";
import { defineCached } from "./definitions.ts";

export const getProjectConfigFieldsSchema = defineCached(
  // deno-lint-ignore require-await
  async () => {
    return {
      schema: objectSchemaFromFieldsFile(schemaPath("project.yml")),
      errorHandlers: [],
    };
  },
  "project-config-fields",
);

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
      await getFrontMatterSchema(),
      projectConfigFields,
    );
    return {
      schema: describeSchema(result, "a project configuration object"),
      errorHandlers: [],
    };
  },
  "project-config",
);
