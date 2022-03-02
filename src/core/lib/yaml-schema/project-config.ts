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

import { objectSchemaFromFieldsObject, SchemaField } from "./from-yaml.ts";

import { getFormatExecuteOptionsSchema } from "./execute.ts";

import {
  getFrontMatterFormatSchema,
  getFrontMatterSchema,
} from "./front-matter.ts";

import { defineCached } from "./definitions.ts";
import { getYamlIntelligenceResource } from "../yaml-intelligence/resources.ts";

export const getProjectConfigFieldsSchema = defineCached(
  // deno-lint-ignore require-await
  async () => {
    return {
      schema: objectSchemaFromFieldsObject(
        getYamlIntelligenceResource("schema/project.yml") as SchemaField[],
      ),
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
