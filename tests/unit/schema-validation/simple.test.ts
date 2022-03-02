/*
 * simple.test.ts
 *
 * Copyright (C) 2022 by RStudio, PBC
 *
 */

import { unitTest } from "../../test.ts";

import { convertFromYaml } from "../../../src/core/lib/yaml-schema/from-yaml.ts";

import { readAndValidateYamlFromMappedString } from "../../../src/core/schema/validated-yaml.ts";

import { asMappedString } from "../../../src/core/lib/mapped-text.ts";

import { setSchemaDefinition } from "../../../src/core/lib/yaml-validation/schema.ts";
import { readYamlFromString } from "../../../src/core/yaml.ts";

unitTest("schema-completions", async () => {
  const yml = `
foo: bar
baz:
  - 1
  - 2
  - 3
NOTALLOWED: 5
bah:
  wut: "wat"`;

  const schema = convertFromYaml(readYamlFromString(`
id: schema-test-1
object:
  properties:
    baz: 
      arrayOf: string
    foo: number
  required: [blah]
  propertyNames:
    string:
      pattern: "[a-z]+"
`));
  setSchemaDefinition(schema);

  let threw = false;
  try {
    await readAndValidateYamlFromMappedString(
      asMappedString(yml),
      schema,
      "This should throw",
    );
  } catch (_e) {
    threw = true;
  }
  if (!threw) {
    throw new Error("validation should have failed.");
  }
});
