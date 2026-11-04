/*
 * listing-pagination.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { yamlValidationUnitTest } from "./utils.ts";
import { getFrontMatterSchema } from "../../../src/core/lib/yaml-schema/front-matter.ts";
import { readAndValidateYamlFromMappedString } from "../../../src/core/lib/yaml-schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";

const cases: [string, string, boolean][] = [
  ["outer-window-left", "outer-window-left: 2", true],
  [
    "all options",
    "inner-window: 1\n    outer-window: 2\n    outer-window-left: 0\n    outer-window-right: 3",
    true,
  ],
  ["unknown property", "outer-window-top: 1", false],
  ["string value", "outer-window: wide", false],
  ["string value for inner-window", "inner-window: '2'", false],
];

for (const [name, options, valid] of cases) {
  yamlValidationUnitTest(`listing pagination ${name}`, async () => {
    const yaml =
      `title: Page\nlisting:\n  contents: posts\n  pagination:\n    ${options}\n`;
    const schema = await getFrontMatterSchema();
    const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
      asMappedString(yaml),
      schema,
    );
    assertEquals(yamlValidationErrors.length === 0, valid, yaml);
  });
}
