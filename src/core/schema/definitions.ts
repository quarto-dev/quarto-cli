/*
* definitions.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { convertFromYaml } from "./from-yaml.ts";
import { idSchema, refSchema } from "./common.ts";
import { readYaml } from "../yaml.ts";
import { error } from "log/mod.ts";
import { schemaPath } from "./utils.ts";
import { buildSchemaResources } from "./from-yaml.ts";

import {
  ValidatorErrorHandlerFunction,
} from "../lib/yaml-validation/errors.ts";

import {
  addValidatorErrorHandler,
} from "../lib/yaml-validation/validator-queue.ts";

import {
  getSchemaDefinition,
  hasSchemaDefinition,
  setSchemaDefinition,
} from "../lib/yaml-validation/schema.ts";

import { ConcreteSchema, Schema } from "../lib/yaml-validation/types.ts";

export function defineCached(
  thunk: () => Promise<
    { schema: ConcreteSchema; errorHandlers: ValidatorErrorHandlerFunction[] }
  >,
  schemaId: string,
): (() => Promise<ConcreteSchema>) {
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
    await define(schema);
    for (const fun of errorHandlers) {
      addValidatorErrorHandler(schema, fun);
    }

    return refSchema(
      schema!.$id as string,
      (schema!.description as string) || `be a {schema['$id']}`,
    );
  };
}

// deno-lint-ignore require-await
export async function define(schema: Schema) {
  if (
    schema !== true && schema !== false && schema.$id &&
    !hasSchemaDefinition(schema.$id)
  ) {
    setSchemaDefinition(schema);
  }
}

export async function loadDefaultSchemaDefinitions() {
  await loadSchemaDefinitions(schemaPath("definitions.yml"));
  await buildSchemaResources();
}

export async function loadSchemaDefinitions(file: string) {
  // deno-lint-ignore no-explicit-any
  const yaml = readYaml(file) as any[];

  // deno-lint-ignore require-await
  await Promise.all(yaml.map(async (yamlSchema) => {
    const schema = convertFromYaml(yamlSchema);
    if (schema.$id === undefined) {
      console.log(JSON.stringify(yamlSchema, null, 2));
      error(JSON.stringify(schema, null, 2));
      throw new Error(`Internal error: unnamed schema in definitions`);
    }
    setSchemaDefinition(schema);
  }));
}
