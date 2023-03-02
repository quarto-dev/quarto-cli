/*
* project-config.ts
*
* JSON Schema for _quarto.yml, Quarto's project configuration YAML
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import {
  allOfSchema as allOfS,
  describeSchema,
  objectSchema as objectS,
  refSchema,
} from "./common.ts";

import { objectSchemaFromFieldsObject, SchemaField } from "./from-yaml.ts";

import { getFormatExecuteOptionsSchema } from "./execute.ts";

import {
  getFrontMatterFormatSchema,
  getFrontMatterSchema,
} from "./front-matter.ts";

import { defineCached } from "./definitions.ts";
import { getYamlIntelligenceResource } from "../yaml-intelligence/resources.ts";
import { AnnotatedParse, LocalizedError, Schema } from "./types.ts";
import { locateAnnotation } from "../yaml-intelligence/annotated-yaml.ts";
import { createLocalizedError } from "../yaml-validation/errors.ts";
import { mappedSubstring } from "../mapped-text.ts";

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

export const getExtensionConfigFieldsSchema = defineCached(
  // deno-lint-ignore require-await
  async () => {
    return {
      schema: objectSchemaFromFieldsObject(
        getYamlIntelligenceResource("schema/extension.yml") as SchemaField[],
      ),
      errorHandlers: [],
    };
  },
  "extension-config-fields",
);

function disallowTopLevelType(
  error: LocalizedError,
  parse: AnnotatedParse,
  /* this is the _outer_ schema, which failed the validation of
   * parse.result. error also holds error.schema, which is a subschema
   * of the outer schema which failed the validation of
   * error.violatingObject (a subobject of parse.result).
   */
  _schema: Schema,
): LocalizedError {
  if (
    !(error.instancePath.length === 1 &&
      error.instancePath[0] === "type")
  ) {
    return error;
  }

  const violatingObject = locateAnnotation(parse, error.instancePath, "key");

  const localizedError = createLocalizedError({
    ...error,
    message: "top-level key 'type' is not allowed in project configuration.",
    violatingObject,
    source: mappedSubstring(
      parse.source,
      violatingObject.start,
      violatingObject.end + 1,
    ),
  });
  localizedError.niceError.info["top-level-type-not-allowed"] =
    "Did you mean to use 'project: type: ...' instead?";

  return localizedError;
}

export const getProjectConfigSchema = defineCached(
  async () => {
    const projectConfigFields = await getProjectConfigFieldsSchema();
    const execute = await getFormatExecuteOptionsSchema();
    const format = await getFrontMatterFormatSchema();
    const profile = refSchema(
      "project-profile",
      "Specify a default profile and profile groups",
    );

    const result = allOfS(
      objectS({
        properties: {
          execute,
          format,
          profile,
        },
        description: "be a Quarto YAML front matter object",
      }),
      execute,
      await getFrontMatterSchema(),
      projectConfigFields,
    );
    return {
      schema: describeSchema(result, "a project configuration object"),
      errorHandlers: [disallowTopLevelType],
    };
  },
  "project-config",
);

export const getExtensionConfigSchema = defineCached(
  async () => {
    const extensionConfig = await getExtensionConfigFieldsSchema();
    return {
      schema: describeSchema(
        extensionConfig,
        "an extension configuration object",
      ),
      errorHandlers: [],
    };
  },
  "extension-config",
);
