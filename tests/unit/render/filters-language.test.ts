/*
 * filters-language.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { unitTest } from "../../test.ts";
import { languageFilterParams } from "../../../src/command/render/filters.ts";
import { Format } from "../../../src/config/types.ts";

function minimalFormat(language: Record<string, unknown>): Format {
  return {
    pandoc: {},
    execute: {},
    render: {},
    metadata: {},
    language,
  } as unknown as Format;
}

// Regression coverage for the PR #14773 body's claim that custom keys
// prefixed callout-, crossref- or environment- reach Lua filter params
// because languageFilterParams selects by prefix over the whole
// format.language table, not an explicit allow-list.
unitTest(
  "languageFilterParams - passes through custom callout-/crossref-/environment- keys",
  // deno-lint-ignore require-await
  async () => {
    const format = minimalFormat({
      "callout-custom-title": "Custom Callout",
      "crossref-custom-title": "Custom Crossref",
      "environment-custom-title": "Custom Environment",
      "not-a-language-prefix": "Should not appear",
    });

    const params = languageFilterParams(format);

    assertEquals(params["callout-custom-title"], "Custom Callout");
    assertEquals(params["crossref-custom-title"], "Custom Crossref");
    assertEquals(params["environment-custom-title"], "Custom Environment");
    assertEquals(params["not-a-language-prefix"], undefined);
  },
);
