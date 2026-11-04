/*
 * cell-options-code-line-fragment-indices.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals, assertRejects } from "../../asserts.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";
import { parseAndValidateCellOptions } from "../../../src/core/lib/partition-cell-options.ts";
import {
  initState,
  setInitializer,
} from "../../../src/core/lib/yaml-validation/state.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import { unitTest } from "../../test.ts";

const validateCell = async (yaml: string) => {
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();
  return await parseAndValidateCellOptions(
    asMappedString(yaml),
    "r",
    true,
    "knitr",
  );
};

for (const value of ["1,2", "1, 2", " 3 ", "0"]) {
  unitTest(`code-line-fragment-indices - accepts "${value}"`, async () => {
    assertEquals(
      await validateCell(`code-line-fragment-indices: "${value}"\n`),
      { "code-line-fragment-indices": value },
    );
  });
}

for (const value of ["1,abc", "1,", "-1", "1.5", ""]) {
  unitTest(`code-line-fragment-indices - rejects "${value}"`, async () => {
    await assertRejects(() =>
      validateCell(`code-line-fragment-indices: "${value}"\n`)
    );
  });
}
