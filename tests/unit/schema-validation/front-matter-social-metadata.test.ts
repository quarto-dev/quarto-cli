/*
 * front-matter-social-metadata.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { yamlValidationUnitTest } from "./utils.ts";
import { getFrontMatterSchema } from "../../../src/core/lib/yaml-schema/front-matter.ts";
import { readAndValidateYamlFromMappedString } from "../../../src/core/lib/yaml-schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";

const cases: [string, string, boolean][] = [
  ["open-graph unknown key", "open-graph:\n  imge-width: 1200\n", false],
  ["open-graph wrong type", "open-graph:\n  description: 42\n", false],
  ["open-graph valid", "open-graph:\n  image-width: 1200\n  locale: fr_FR\n", true],
  ["open-graph boolean", "open-graph: true\n", true],
  ["open-graph null", "open-graph:\n", true],
  ["twitter-card unknown key", "twitter-card:\n  card-styl: summary\n", false],
  ["twitter-card valid", "twitter-card:\n  card-style: summary\n  creator: '@me'\n", true],
  ["twitter-card null", "twitter-card:\n", true],
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
