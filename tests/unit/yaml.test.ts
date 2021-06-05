/*
* yaml.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { assert } from "testing/asserts.ts";
import { Metadata } from "../../src/config/metadata.ts";
import { readYamlFromString } from "../../src/core/yaml.ts";

const yamlStr = `
project:
  type: site
other:
  array:
    - foo
    - bar
`;

Deno.test("partitionYaml", () => {
  const yaml = readYamlFromString(yamlStr) as Metadata;

  // Tests of the result
  assert(
    (yaml.project as Metadata).type === "site",
    "Project type not read properly",
  );
  assert(
    Array.isArray((yaml.other as Metadata).array) &&
      ((yaml.other as Metadata).array as string[]).length === 2,
    "Other array key not read properly",
  );
});
