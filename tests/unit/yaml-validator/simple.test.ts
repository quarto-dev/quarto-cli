/*
 * simple.test.ts
 *
 * Copyright (C) 2022 by RStudio, PBC
 *
 */

import { unitTest } from "../../test.ts";

import { assert, assertEquals } from "testing/asserts.ts";

import { readAnnotatedYamlFromString } from "../../../src/core/schema/annotated-yaml.ts";

import { convertFromYAMLString } from "../../../src/core/schema/from-yaml.ts";

import { readAndValidateYamlFromMappedString } from "../../../src/core/schema/validated-yaml.ts";

import { asMappedString } from "../../../src/core/lib/mapped-text.ts";

import { setSchemaDefinition } from "../../../src/core/lib/yaml-validation/schema.ts";

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

  debugger;
  const schema = convertFromYAMLString(`
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
`);
  debugger;
  setSchemaDefinition(schema);

  const annotation = readAndValidateYamlFromMappedString(
    asMappedString(yml),
    schema,
    "This should throw",
  );
});
