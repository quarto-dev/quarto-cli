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
import { getFormatSchema } from "../../../src/core/lib/yaml-schema/format-schemas.ts";
import {
  AnyOfSchema,
  ObjectSchema,
} from "../../../src/core/lib/yaml-schema/types.ts";

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

// The options only take effect where columns.lua lays them out: HTML documents,
// LaTeX/PDF and Typst. HTML slides, dashboards and beamer do not.
const formatCases: [string, boolean][] = [
  ["html", true],
  ["pdf", true],
  ["latex", true],
  ["typst", true],
  ["revealjs", false],
  ["dashboard", false],
  ["beamer", false],
];

for (const [format, offered] of formatCases) {
  // deno-lint-ignore require-await
  yamlValidationUnitTest(`${format} format schema offers column options`, async () => {
    const formatSchema = getFormatSchema(format) as AnyOfSchema;
    const properties = (formatSchema.anyOf[0] as ObjectSchema).properties ?? {};
    for (const name of ["column", "fig-column", "tbl-column"]) {
      assertEquals(name in properties, offered, `${format}: ${name}`);
    }
  });
}
