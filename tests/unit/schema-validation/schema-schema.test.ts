/*
 * schema-schema.test.ts
 *
 * Copyright (C) 2022 by RStudio, PBC
 *
 */

import { schemaPath } from "../../../src/core/schema/utils.ts";
import { getSchemaSchemas } from "../../../src/core/schema/yaml-schema-schema.ts";
import { yamlValidationUnitTest } from "./utils.ts";
import {
  arraySchema,
  idSchema,
  refSchema,
} from "../../../src/core/schema/common.ts";
import { readAndValidateYamlFromFile } from "../../../src/core/schema/validated-yaml.ts";
import { expandGlobSync } from "fs/expand_glob.ts";

yamlValidationUnitTest("schema-schema", async () => {
  const _d = getSchemaSchemas(); // this registers the schema schema
  const yamlSchemaArray = idSchema(
    arraySchema(refSchema("schema/schema", "")),
    "schema-array",
  );

  await readAndValidateYamlFromFile(
    schemaPath("schema.yml"),
    yamlSchemaArray,
    "schema schema validation",
  );

  await readAndValidateYamlFromFile(
    schemaPath("definitions.yml"),
    yamlSchemaArray,
    "schema definitions",
  );
});

yamlValidationUnitTest("quarto-schemas", async () => {
  const schema = idSchema(
    arraySchema(refSchema("schema/schema-field", "")),
    "schema-field-array",
  );
  for (
    const walk of expandGlobSync(schemaPath("{project,{cell,document}-*}.yml"))
  ) {
    await readAndValidateYamlFromFile(
      walk.path,
      schema,
      walk.path,
    );
  }
});
