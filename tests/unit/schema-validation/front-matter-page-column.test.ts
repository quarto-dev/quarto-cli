/*
 * front-matter-page-column.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "../../asserts.ts";
import { yamlValidationUnitTest } from "./utils.ts";
import { getFrontMatterSchema } from "../../../src/core/lib/yaml-schema/front-matter.ts";
import { readAndValidateYamlFromMappedString } from "../../../src/core/lib/yaml-schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";

const cases: [string, string, boolean][] = [
  ["column invalid", "column: banana\n", false],
  ["column valid", "column: margin\n", true],
  ["fig-column invalid", "fig-column: banana\n", false],
  ["fig-column valid", "fig-column: page\n", true],
  ["tbl-column invalid", "tbl-column: banana\n", false],
  ["tbl-column valid", "tbl-column: screen-inset\n", true],
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
