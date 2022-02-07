/*
 * simple.test.ts
 *
 * Copyright (C) 2022 by RStudio, PBC
 *
 */

import { unitTest } from "../../test.ts";

import { assert, assertEquals } from "testing/asserts.ts";

import { readAnnotatedYamlFromString } from "../../../src/core/schema/annotated-yaml.ts";



unitTest("schema-completions", async () => {
  const yml = `
foo: bar
baz:
  - 1
  - 2
  - 3
bah:
  wut: "wat"`;
  const annotation = readAnnotatedYamlFromString(yml);

  const 
});
