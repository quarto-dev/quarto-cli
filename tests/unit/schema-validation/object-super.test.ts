/*
* object-super.test.ts
*
* Copyright (C) 2022 Posit Software, PBC
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
} from "../../../src/core/lib/yaml-schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";
import { refSchema } from "../../../src/core/lib/yaml-schema/common.ts";
import { assert } from "testing/asserts";

yamlValidationUnitTest("object-super-closed", async () => {
  const _schema1 = schemaFromString(`
id: object-super-closed-1
object:
  closed: true
  properties:
    foo: string
  required: all
`);
  const schema2 = schemaFromString(`
id: object-super-closed-2
object:
  super:
    resolveRef: object-super-closed-1
  closed: true
  properties:
    bar: string
  required: all
`);

  const obj1 = `
bar: yeah
`;
  const obj2 = `
foo: yeah
`;
  const obj3 = `
bar: yeah
foo: yeah
`;

  await assertYamlValidationFails(async () => {
    const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
      asMappedString(obj1),
      schema2,
    );
    throw new ValidationError("This should reject", yamlValidationErrors);
  }, (e) => {
    return expectValidationError(e)
      .toHaveLength(1)
      .forSchemaPathToEndWith("required");
  });
  await assertYamlValidationFails(async () => {
    const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
      asMappedString(obj2),
      schema2,
    );
    throw new ValidationError("This should reject", yamlValidationErrors);
  }, (e) => {
    return expectValidationError(e)
      .toHaveLength(1)
      .forSchemaPathToEndWith("required");
  });

  const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
    asMappedString(obj3),
    schema2,
  );
  assert(yamlValidationErrors.length === 0);
});

yamlValidationUnitTest("object-super", async () => {
  const _schema1 = schemaFromString(`
id: test-schema-1
object:
  properties:
    foo: string
`);
  const schema2 = schemaFromString(`
id: test-schema-2
object:
  super:
    resolveRef: test-schema-1
  properties:
    bar: number
  `);

  const obj = `
foo: 3
bar: "bar"
`;

  await assertYamlValidationFails(async () => {
    const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
      asMappedString(obj),
      schema2,
    );
    throw new ValidationError("This should reject", yamlValidationErrors);
  }, (e) => {
    return expectValidationError(e)
      .forSchemaPathToEndWith("type", 0)
      .forSchemaPathToEndWith("type", 1)
      .toHaveLength(2);
  });
});

yamlValidationUnitTest("object-super-2", async () => {
  const obj = `
website:
  title: "Sippin' Yack and Talkin' Smack"
  twitter-card: 
    image: [profile.jpg, 2, 3, false]
`;
  try {
    await readAndValidateYamlFromMappedString(
      asMappedString(obj),
      refSchema("project-config", ""),
    );
  } catch (e) {
    return expectValidationError(e)
      .forSchemaPathToEndWith("type")
      .toHaveLength(1);
  }
});
