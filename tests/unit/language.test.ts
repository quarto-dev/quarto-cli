/*
 * language.test.ts
 *
 * Tests for language translation resolution.
 * Validates fixes for https://github.com/quarto-dev/quarto-cli/issues/14772
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import {
  readLanguageTranslations,
  translationsForLang,
} from "../../src/core/language.ts";
import { FormatLanguage } from "../../src/config/types.ts";
import { withTempDir } from "../utils.ts";
import { fullInit } from "./schema-validation/utils.ts";

await fullInit();

unitTest(
  "translationsForLang - keeps a null-valued custom key",
  // deno-lint-ignore require-await
  async () => {
    const language = {
      "custom-key": null,
    } as unknown as FormatLanguage;

    const result = translationsForLang(language, "en");

    assert(
      Object.prototype.hasOwnProperty.call(result, "custom-key"),
      "custom-key should survive translationsForLang, not be dropped because typeof null === 'object'",
    );
    assert(
      result["custom-key" as keyof FormatLanguage] === null,
      "custom-key should keep its null value",
    );
  },
);

unitTest(
  "readLanguageTranslations - keeps a null-valued custom key from a locale-variation file",
  async () => {
    await withTempDir(async (dir) => {
      const baseFile = join(dir, "some-language.yml");
      const frFile = join(dir, "some-language-fr.yml");
      Deno.writeTextFileSync(baseFile, "{}\n");
      Deno.writeTextFileSync(frFile, "custom-key:\n");

      const { language } = await readLanguageTranslations(baseFile);

      assert(
        typeof language["fr"] === "object" && language["fr"] !== null,
        "fr variation should be present",
      );
      const fr = language["fr"] as FormatLanguage;
      assert(
        Object.prototype.hasOwnProperty.call(fr, "custom-key"),
        "custom-key should survive readLanguageTranslations, not be dropped because typeof null === 'object'",
      );
      assert(
        fr["custom-key" as keyof FormatLanguage] === null,
        "custom-key should keep its null value",
      );
    });
  },
);
