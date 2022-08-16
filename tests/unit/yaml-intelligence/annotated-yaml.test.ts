/*
* annotated-yaml.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { assert } from "testing/asserts.ts";

import { readAnnotatedYamlFromString } from "../../../src/core/lib/yaml-intelligence/annotated-yaml.ts";
import { yamlValidationUnitTest } from "../schema-validation/utils.ts";

yamlValidationUnitTest(
  "annotated-yaml-should-respect-json-schema",
  // deno-lint-ignore require-await
  async () => {
    const annotation = readAnnotatedYamlFromString("2020-01-01");
    assert(typeof annotation.result === "string");
  },
);
