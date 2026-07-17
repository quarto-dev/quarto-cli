/*
 * yaml-intelligence-embedded-html.test.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 *
 */

const yamlStr = `
format:
  html:
    toc-title: >
      Contents
`;

import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../../src/core/lib/yaml-validation/state.ts";
import { readAndValidateYamlFromMappedString } from "../../../src/core/lib/yaml-schema/validated-yaml.ts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";

import { getProjectConfigSchema } from "../../../src/core/lib/yaml-schema/project-config.ts";

async function fullInit() {
  await initYamlIntelligenceResourcesFromFilesystem();
}

unitTest("yaml-intelligence-folded-block-strings", async () => {
  setInitializer(fullInit);
  await initState();
  const configSchema = await getProjectConfigSchema();

  const { yamlValidationErrors } = await readAndValidateYamlFromMappedString(
    asMappedString(yamlStr),
    configSchema,
  );

  assert(yamlValidationErrors.length === 0);
});
