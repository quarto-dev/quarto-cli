/*
* yaml.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import { Metadata } from "../../src/config/types.ts";
import { readYamlFromString } from "../../src/core/yaml.ts";

import { readAnnotatedYamlFromString } from "../../src/core/lib/yaml-intelligence/annotated-yaml.ts";
import { yamlValidationUnitTest } from "./schema-validation/utils.ts";

const yamlStr = `
project:
  type: website
other:
  array:
    - foo
    - bar
`;

// deno-lint-ignore require-await
unitTest("yaml", async () => {
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

const circularYml = "foo: &foo\n  bar: *foo";

// deno-lint-ignore require-await
unitTest("yaml-circular-should-fail", async () => {
  try {
    readYamlFromString(circularYml);
    assert(false, "circular structure should have raised");
  } catch (_e) {
    // we expect to raise
  }
  try {
    readAnnotatedYamlFromString(circularYml);
    assert(false, "circular structure should have raised");
  } catch (_e) {
    // we expect to raise
  }
});

const sharedYml = "foo:\n  bar: &bar\n    baz: bah\n  baz: *bar";
// deno-lint-ignore require-await
unitTest("yaml-shared-should-pass", async () => {
  readYamlFromString(sharedYml);
  readYamlFromString(circularYml);
});

const exprYml = `label: fig-test
fig-cap: !expr paste("Air Quality")`;

// deno-lint-ignore require-await
unitTest("yaml-expr-tag-should-pass", async () => {
  // deno-lint-ignore no-explicit-any
  const yml = readYamlFromString(exprYml) as any;
  assert(yml["fig-cap"].tag === "!expr");
  assert(yml["fig-cap"].value === 'paste("Air Quality")');
});

// deno-lint-ignore require-await
yamlValidationUnitTest("annotated-yaml-expr-tag-should-pass", async () => {
  // deno-lint-ignore no-explicit-any
  const yml = readAnnotatedYamlFromString(exprYml).result as any;
  assert(yml["fig-cap"].tag === "!expr");
  assert(yml["fig-cap"].value === 'paste("Air Quality")');
});
