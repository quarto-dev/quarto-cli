/*
 * front-matter-website-navigation.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { yamlValidationUnitTest } from "./utils.ts";
import { getFrontMatterSchema } from "../../../src/core/lib/yaml-schema/front-matter.ts";
import { readAndValidateYamlFromMappedString } from "../../../src/core/lib/yaml-schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";

const cases: [string, string, boolean][] = [
  ["bread-crumbs wrong type", "bread-crumbs: 42\n", false],
  ["bread-crumbs false", "bread-crumbs: false\n", true],
  ["back-to-top-navigation wrong type", "back-to-top-navigation: 42\n", false],
  ["back-to-top-navigation false", "back-to-top-navigation: false\n", true],
  ["page-navigation wrong type", "page-navigation: 42\n", false],
  ["page-navigation true", "page-navigation: true\n", true],
  ["margin-header wrong type", "margin-header:\n  text: 42\n", false],
  ["margin-header string", "margin-header: Some text\n", true],
  ["margin-header array", "margin-header:\n  - one\n  - two\n", true],
  ["margin-footer wrong type", "margin-footer:\n  text: 42\n", false],
  ["margin-footer string", "margin-footer: Some text\n", true],
];

for (const [name, yaml, valid] of cases) {
  yamlValidationUnitTest(`front matter ${name}`, async () => {
    const schema = await getFrontMatterSchema();
    const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
      asMappedString(`title: Page\n${yaml}`),
      schema,
    );
    assertEquals(yamlValidationErrors.length === 0, valid, yaml);
  });
}
