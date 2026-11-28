/*
 * website-sidebar-section-href.test.ts
 *
 * Tests that markdown in sidebar section titles is rendered correctly when
 * the section has an href. Without the fix, the .sidebar-item-text element
 * is a plain link without data-bs-target, so the markdown substitution in
 * sidebarContentsHandler() fails to recover the sectionId and leaves raw
 * markdown (e.g. **More info**) in the DOM instead of rendering it.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { ensureHtmlElements, noErrorsOrWarnings } from "../../verify.ts";

const renderDir = docs("websites/website-sidebar-section-href");
const outDir = join(renderDir, "_site");

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
  ],
  {
    teardown: async () => safeRemoveSync(outDir, { recursive: true }),
  },
);
