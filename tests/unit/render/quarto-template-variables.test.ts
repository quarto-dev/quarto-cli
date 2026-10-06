/*
 * quarto-template-variables.test.ts
 *
 * Unit tests for buildQuartoTemplateVariables in
 * src/command/render/quarto-template-variables.ts.
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";

import {
  buildQuartoTemplateVariables,
  QuartoTemplateVariables,
} from "../../../src/command/render/quarto-template-variables.ts";
import { PandocOptions } from "../../../src/command/render/types.ts";
import { FormatLanguage } from "../../../src/config/types.ts";

// Build a minimal PandocOptions stub. The builder only reads
// options.format.language, so the rest of the (large) PandocOptions
// surface is intentionally absent.
function optionsWith(
  language: FormatLanguage | undefined,
): PandocOptions {
  return { format: { language } } as unknown as PandocOptions;
}

// deno-lint-ignore require-await
unitTest(
  "quarto-template-variables - missing format.language returns undefined",
  async () => {
    const result = buildQuartoTemplateVariables(optionsWith(undefined));
    assertEquals(result, undefined);
  },
);

// deno-lint-ignore require-await
unitTest(
  "quarto-template-variables - populated language is surfaced under the language field",
  async () => {
    const language: FormatLanguage = {
      "crossref-ch-prefix": "Chapitre",
      "toc-title-document": "Table des matières",
    };
    const result = buildQuartoTemplateVariables(optionsWith(language));
    assertEquals(result, { language });
  },
);

// deno-lint-ignore require-await
unitTest(
  "quarto-template-variables - language object is referenced verbatim (shallow copy contract)",
  async () => {
    const language: FormatLanguage = { "crossref-ch-prefix": "Chapter" };
    const result = buildQuartoTemplateVariables(optionsWith(language));
    assert(result !== undefined);
    // The contract is intentional: we hand the same reference through
    // to the defaults file. If a defensive copy is ever needed, change
    // the builder and update this test.
    assert(result!.language === language);
  },
);

// deno-lint-ignore require-await
unitTest(
  "quarto-template-variables - empty language object still produces a vars wrapper",
  async () => {
    // Documents current behavior: an empty (but defined) language map
    // is truthy and lands as `language: {}` in the returned wrapper.
    // The defaults-file write site is responsible for handling the
    // case where the resulting nested map is empty.
    const result = buildQuartoTemplateVariables(optionsWith({}));
    assertEquals(result, { language: {} } as QuartoTemplateVariables);
  },
);
