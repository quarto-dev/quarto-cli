/*
 * cmd.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../core/schema/utils.ts";
import { readAndValidateYamlFromMappedString } from "../../../core/lib/yaml-schema/validated-yaml.ts";
import { mappedStringFromFile } from "../../../core/mapped-text.ts";
import {
  getSchemaDefinition,
  setSchemaDefinition,
} from "../../../core/lib/yaml-validation/schema.ts";
import { error } from "../../../deno_ral/log.ts";
import { tidyverseFormatError } from "../../../core/lib/errors.ts";
import {
  convertFromYaml,
  getSchemaSchemas,
} from "../../../core/lib/yaml-schema/from-yaml.ts";

const getSchema = async (schemaNameOrFile: string) => {
  if (schemaNameOrFile.endsWith(".yml")) {
    getSchemaSchemas();
    // it's a file, we load it, validate it against the schema schema
    // and then return it
    const file = mappedStringFromFile(schemaNameOrFile);
    const schema = getSchemaDefinition("schema/schema");
    const result = await readAndValidateYamlFromMappedString(
      file,
      schema,
    );
    if (result.yamlValidationErrors.length) {
      error("Schema file is not valid");
      for (const err of result.yamlValidationErrors) {
        error(tidyverseFormatError(err.niceError), { colorize: false });
      }
      Deno.exit(1);
    }
    const schemaName = `user-schema-${schemaNameOrFile}`;
    const newSchema = convertFromYaml(result.yaml);
    newSchema.$id = schemaName;
    setSchemaDefinition(newSchema);
    return getSchemaDefinition(schemaName);
  } else {
    // it's a schema name, we get it from the schema registry
    // and return it
    return getSchemaDefinition(schemaNameOrFile);
  }
};

export const validateYamlCommand = new Command()
  .name("validate-yaml")
  .hidden()
  .arguments("<input:string>")
  .option(
    "-s, --schema [schema:string]",
    "Name of schema in Quarto's definitions.yml. If string ends with .yml, it is treated as a file name for a new schema, which is validated, loaded, and then used.",
  )
  .option(
    "--json",
    "If set, output error messages in JSON format.",
  )
  .description(
    "Validates a YAML file against Quarto's schemas.\n\n",
  )
  .action(async (options: any, input: string) => {
    await initYamlIntelligenceResourcesFromFilesystem();
    if (!options.schema) {
      throw new Error("Schema name or file is required");
    }
    const file = mappedStringFromFile(input);
    const schema = await getSchema(options.schema);
    const result = await readAndValidateYamlFromMappedString(
      file,
      schema,
    );
    if (options.json) {
      console.log(JSON.stringify(result.yamlValidationErrors, null, 2));
    } else {
      for (const err of result.yamlValidationErrors) {
        error(tidyverseFormatError(err.niceError), { colorize: false });
      }
    }
    if (result.yamlValidationErrors.length) {
      Deno.exit(1);
    }
  });
