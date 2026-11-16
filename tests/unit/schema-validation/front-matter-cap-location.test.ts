/*
 * front-matter-cap-location.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals, assertStringIncludes } from "../../asserts.ts";
import { yamlValidationUnitTest } from "./utils.ts";
import { getFrontMatterSchema } from "../../../src/core/lib/yaml-schema/front-matter.ts";
import { readAndValidateYamlFromMappedString } from "../../../src/core/lib/yaml-schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";
import { getFormatSchema } from "../../../src/core/lib/yaml-schema/format-schemas.ts";
import {
  AnyOfSchema,
  ObjectSchema,
} from "../../../src/core/lib/yaml-schema/types.ts";

// Caption location options are offered for these formats. The format
// restriction on `margin` completions is tagged on the value schema.
const formats = [
  "html",
  "pdf",
  "latex",
  "typst",
  "revealjs",
  "dashboard",
  "beamer",
];

for (const format of formats) {
  // deno-lint-ignore require-await
  yamlValidationUnitTest(`${format} format schema offers caption location options`, async () => {
    const formatSchema = getFormatSchema(format) as AnyOfSchema;
    const properties = (formatSchema.anyOf[0] as ObjectSchema).properties ?? {};
    for (const name of ["cap-location", "fig-cap-location", "tbl-cap-location"]) {
      assertEquals(name in properties, true, `${format}: ${name}`);
    }
  });
}

// Validation does not depend on the format, so `margin` stays a valid value
// even where it is not offered.
const options = ["cap-location", "fig-cap-location", "tbl-cap-location"];

for (const option of options) {
  for (const value of ["top", "bottom", "margin"]) {
    yamlValidationUnitTest(`front matter ${option}: ${value} is valid`, async () => {
      const schema = await getFrontMatterSchema();
      const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
        asMappedString(`title: Page\n${option}: ${value}\n`),
        schema,
      );
      assertEquals(yamlValidationErrors.length, 0);
    });
  }

  yamlValidationUnitTest(`front matter ${option}: banana is rejected`, async () => {
    const schema = await getFrontMatterSchema();
    const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
      asMappedString(`title: Page\n${option}: banana\n`),
      schema,
    );
    assertEquals(yamlValidationErrors.length, 1);
    assertStringIncludes(yamlValidationErrors[0].niceError.heading, "`margin`");
  });

  yamlValidationUnitTest(`front matter ${option}: a typo of margin suggests margin`, async () => {
    const schema = await getFrontMatterSchema();
    const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
      asMappedString(`title: Page\n${option}: margn\n`),
      schema,
    );
    assertEquals(yamlValidationErrors.length, 1);
    assertStringIncludes(
      String(yamlValidationErrors[0].niceError.info["did-you-mean-value"]),
      "margin",
    );
  });
}
