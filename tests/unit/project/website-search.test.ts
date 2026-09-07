/*
 * website-search.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "testing/asserts";
import { unitTest } from "../../test.ts";
import { websiteSearchIncludeInHeader } from "../../../src/project/types/website/website-search.ts";
import { createMockProjectContext } from "./utils.ts";
import { Format } from "../../../src/config/types.ts";
import { TempContext } from "../../../src/core/temp-types.ts";

function minimalFormat(language: Record<string, unknown>): Format {
  return {
    pandoc: {},
    execute: {},
    render: {},
    metadata: {},
    language,
  } as unknown as Format;
}

function tempContextIn(dir: string): TempContext {
  return {
    baseDir: dir,
    createFileFromString: () => {
      throw new Error("not implemented in test mock");
    },
    createFile: (options?: Deno.MakeTempOptions) =>
      Deno.makeTempFileSync({ dir, ...options }),
    createDir: () => Deno.makeTempDirSync({ dir }),
    cleanup: () => {},
    onCleanup: () => {},
  };
}

// Regression coverage for the PR #14773 body's claim that custom
// search-prefixed keys reach the website search JS options, because
// websiteSearchIncludeInHeader selects by prefix over the whole
// format.language table, not an explicit allow-list.
unitTest(
  "websiteSearchIncludeInHeader - passes through custom search- keys",
  async () => {
    const dir = Deno.makeTempDirSync({ prefix: "quarto-search-test" });
    try {
      const project = createMockProjectContext({ dir });
      const temp = tempContextIn(dir);
      const format = minimalFormat({
        "search-custom-label": "Custom Search Label",
        "not-a-language-prefix": "Should not appear",
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
      Deno.removeSync(dir, { recursive: true });
    }
  },
);
