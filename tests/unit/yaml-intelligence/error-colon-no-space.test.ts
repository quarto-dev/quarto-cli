/*
* error-colon-no-space.test.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { asMappedString } from "../../../src/core/mapped-text.ts";
import {
  readAndValidateYamlFromMappedString,
  ValidationError,
} from "../../../src/core/lib/yaml-schema/validated-yaml.ts";

import {
  assertYamlValidationFails,
  expectValidationError,
  schemaFromString,
  yamlValidationUnitTest,
} from "../schema-validation/utils.ts";

yamlValidationUnitTest("error-colon-no-space", async () => {
  const schema = schemaFromString(`
id: schema-test-1
record:
  baz: number
  bar: string
`);
  const ymlStr = `
title:Test
`;
  await assertYamlValidationFails(async () => {
    const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
      asMappedString(ymlStr),
      schema,
    );
    throw new ValidationError("this should throw", yamlValidationErrors);
  }, (e) =>
    expectValidationError(e)
      .toHaveLength(1)
      .forSchemaPathToEndWith(["object", "type"])
      .toHaveInfo("suggestion-fix"));
});
