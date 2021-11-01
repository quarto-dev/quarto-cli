/*
* yaml.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { unitTest } from "../test.ts";
import { assert } from "testing/asserts.ts";
import { Metadata } from "../../src/config/types.ts";
import { readYamlFromString } from "../../src/core/yaml.ts";

const yamlStr = `
project:
  type: website
other:
  array:
    - foo
    - bar
`;

unitTest("yaml", () => {
  const yaml = readYamlFromString(yamlStr) as Metadata;

  // Tests of the result
  assert(
    (yaml.project as Metadata).type === "website",
    "Project type not read properly",
  );
  assert(
    Array.isArray((yaml.other as Metadata).array) &&
      ((yaml.other as Metadata).array as string[]).length === 2,
    "Other array key not read properly",
  );
});
