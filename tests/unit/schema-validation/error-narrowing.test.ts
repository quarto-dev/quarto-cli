/*
* error-narrowing.test.ts
*
* Unit tests regarding the YAML validation error narrowing heuristics
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import {
  assertYamlValidationFails,
  expectValidationError,
  schemaFromString,
  yamlValidationUnitTest,
} from "./utils.ts";
import {
  readAndValidateYamlFromMappedString,
  ValidationError,
} from "../../../src/core/schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";

// deno-lint-ignore require-await
yamlValidationUnitTest("schema-narrowing", async () => {
  const schema = schemaFromString(`
id: schema-test-1
record:
  baz: number
  bar: string
`);
  const ymlStr = `
baz: 3
`;
  assertYamlValidationFails(async () => {
    await readAndValidateYamlFromMappedString(
      asMappedString(ymlStr),
      schema,
      "This should reject",
    );
  }, (e: ValidationError) =>
    expectValidationError(e)
      .toHaveLength(1)
      .forSchemaPathToEndWith("required"));
});
