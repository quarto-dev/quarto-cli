/*
 * definitions.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { idSchema, refSchema } from "./common.ts";
import { getYamlIntelligenceResource } from "../yaml-intelligence/resources.ts";
import { buildResourceSchemas, convertFromYaml } from "./from-yaml.ts";

import { ValidatorErrorHandlerFunction } from "../yaml-validation/types.ts";

import {
  addValidatorErrorHandler,
} from "../yaml-validation/validator-queue.ts";

import {
  getSchemaDefinition,
  hasSchemaDefinition,
  setSchemaDefinition,
} from "../yaml-validation/schema.ts";

import { ConcreteSchema, JSONValue, Schema } from "./types.ts";
import { InternalError } from "../error.ts";

export function defineCached(
  thunk: () => Promise<
    { schema: ConcreteSchema; errorHandlers: ValidatorErrorHandlerFunction[] }
  >,
  schemaId: string,
): () => Promise<ConcreteSchema> {
  let schema: ConcreteSchema;

  return async () => {
    // when running on the CLI outside of quarto build-js, these
    // definitions will already exist.
    if (hasSchemaDefinition(schemaId)) {
      schema = getSchemaDefinition(schemaId);
      return refSchema(
        schema.$id as string,
        schema.description || `be a {schema['$id'] as string}`,
      );
    }

    const result = await thunk();
    const { errorHandlers } = result;
    schema = result.schema;
    if (schemaId !== schema!.$id as string) {
      schema = idSchema(schema, schemaId);
    }
    define(schema);
    for (const fun of errorHandlers) {
      addValidatorErrorHandler(schema, fun);
    }

    return refSchema(
      schema!.$id as string,
      (schema!.description as string) || `be a {schema['$id']}`,
    );
  };
}

export function define(schema: Schema) {
  if (
    schema !== true && schema !== false && schema.$id &&
    !hasSchemaDefinition(schema.$id)
  ) {
    setSchemaDefinition(schema);
  }
}

export async function loadDefaultSchemaDefinitions() {
  await loadSchemaDefinitions(
    getYamlIntelligenceResource("schema/definitions.yml") as JSONValue[],
  );
  await buildResourceSchemas();
}

export async function loadSchemaDefinitions(yaml: JSONValue[]) {
  // deno-lint-ignore require-await
  await Promise.all(yaml.map(async (yamlSchema) => {
    const schema = convertFromYaml(yamlSchema);
    if (schema.$id === undefined) {
      throw new InternalError(`Unnamed schema in definitions`);
    }
    setSchemaDefinition(schema);
  }));
}
