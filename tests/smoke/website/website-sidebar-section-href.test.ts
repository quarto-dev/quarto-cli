/*
 * website-sidebar-section-href.test.ts
 *
 * Tests that markdown in sidebar section titles is rendered correctly when
 * the section has an href. Without the fix, the .sidebar-item-text element
 * is a plain link without data-bs-target, so the markdown substitution in
 * sidebarContentsHandler() fails to recover the sectionId and leaves raw
 * markdown (e.g. **More info**) in the DOM instead of rendering it.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import {
  ensureFileRegexMatches,
  ensureHtmlElements,
  noErrorsOrWarnings,
} from "../../verify.ts";

const renderDir = docs("websites/website-sidebar-section-href");
const outDir = join(Deno.cwd(), renderDir, "_site");

testQuartoCmd(
  "render",
  [renderDir],
  [
    noErrorsOrWarnings,
    // Markdown in section title must be rendered: **More info** → <strong>
    ensureHtmlElements(
      join(outDir, "index.html"),
      [".sidebar-item-text strong"],
    ),
    // Raw markdown asterisks must not appear in the sidebar HTML
    ensureFileRegexMatches(
      join(outDir, "index.html"),
      [],
      [/sidebar-item-text[^<]*\*\*/],
    ),
  ],
  {
    teardown: async () => {
      if (existsSync(outDir)) {
        await Deno.remove(outDir, { recursive: true });
      }
    },
  },
);
