/*
 * annotated-yaml.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
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

yamlValidationUnitTest(
  "https://github.com/quarto-dev/quarto-cli/issues/6269",
  // deno-lint-ignore require-await
  async () => {
    // ensure this doesn't crash
    const annotation = readAnnotatedYamlFromString("|\n  Line 1\n  Line 2\n");
    assert(typeof annotation.result === "string");
  },
);
