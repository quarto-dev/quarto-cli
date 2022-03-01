/*
* object-super.test.ts
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
} from "../../../src/core/schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";
import { refSchema } from "../../../src/core/schema/common.ts";

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
    await readAndValidateYamlFromMappedString(
      asMappedString(obj1),
      schema2,
      "This should reject",
    );
  }, (e) => {
    return expectValidationError(e)
      .toHaveLength(1)
      .forSchemaPathToEndWith("required");
  });
  await assertYamlValidationFails(async () => {
    await readAndValidateYamlFromMappedString(
      asMappedString(obj2),
      schema2,
      "This should reject",
    );
  }, (e) => {
    return expectValidationError(e)
      .toHaveLength(1)
      .forSchemaPathToEndWith("required");
  });

  await readAndValidateYamlFromMappedString(
    asMappedString(obj3),
    schema2,
    "This should pass",
  );
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
    await readAndValidateYamlFromMappedString(
      asMappedString(obj),
      schema2,
      "This should reject",
    );
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
      "This should pass",
    );
  } catch (e) {
    return expectValidationError(e)
      .forSchemaPathToEndWith("type")
      .toHaveLength(1);
  }
});
