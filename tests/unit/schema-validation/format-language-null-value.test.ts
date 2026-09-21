/*
 * format-language-null-value.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert } from "testing/asserts";
import { unitTest } from "../../test.ts";
import { withValidator } from "../../../src/core/lib/yaml-validation/validator-queue.ts";
import { WithValidatorFun } from "../../../src/core/lib/yaml-validation/validator-queue.ts";
import { LocalizedError } from "../../../src/core/lib/yaml-schema/types.ts";
import { fullInit, readSelfValidatingSchemaTestFile } from "./utils.ts";
import { docs } from "../../utils.ts";

await fullInit();

unitTest(
  "format-language schema rejects null for a shipped key (#14813 policy, quarto-cli-rc1v)",
  async () => {
    const input = docs("schema-validation/format-language-null-value.yml");
    const { schema, annotation, mappedYaml } =
      readSelfValidatingSchemaTestFile(input);

    const validate: WithValidatorFun<LocalizedError[]> = async (
      validator,
    ) => {
      const valResult = await validator.validateParse(mappedYaml, annotation);
      return valResult.errors;
    };

    const errors = await withValidator(schema, validate);

    assert(
      errors.length > 0,
      "null should fail validation for a shipped format-language key; " +
        "empty string is the supported way to clear a shipped default",
    );
  },
);
