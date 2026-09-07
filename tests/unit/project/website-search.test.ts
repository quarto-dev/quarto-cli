/*
 * website-search.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { unitTest } from "../../test.ts";
import { websiteSearchIncludeInHeader } from "../../../src/project/types/website/website-search.ts";
import { createMockProjectContext } from "./utils.ts";
import { createMockFormat } from "../format-utils.ts";
import { createTempContext } from "../../../src/core/temp.ts";

// Regression coverage for the PR #14773 body's claim that custom
// search-prefixed keys reach the website search JS options, because
// websiteSearchIncludeInHeader selects by prefix over the whole
// format.language table, not an explicit allow-list.
unitTest(
  "websiteSearchIncludeInHeader - passes through custom search- keys",
  async () => {
    const project = createMockProjectContext();
    const temp = createTempContext();
    try {
      const format = createMockFormat({
        language: {
          "search-custom-label": "Custom Search Label",
          "not-a-language-prefix": "Should not appear",
        },
      });

      const scriptFile = await websiteSearchIncludeInHeader(
        project,
        format,
        temp,
      );
      const content = Deno.readTextFileSync(scriptFile);

      assertEquals(content.includes('"search-custom-label": "Custom Search Label"'), true);
      assertEquals(content.includes("Should not appear"), false);
    } finally {
      temp.cleanup();
      project.cleanup();
    }
  },
);
