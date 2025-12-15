/*
 * website-sidebar-section-index.test.ts
 *
 * Tests that sidebar section headers correctly link to index files with
 * non-qmd extensions (like .ipynb) in subdirectories. This exercises the
 * indexFileHrefForDir() -> engineValidExtensions() code path in
 * website-sidebar-auto.ts.
 *
 * The test uses a section with glob pattern (contents: subdir/*) which
 * triggers indexFileHrefForDir() to scan for index files. The subdir
 * contains both index.ipynb and other.qmd - the section header should
 * link to index.ipynb while other.qmd appears as a child item.
 *
 * Note: A second file (other.qmd) is required because sidebaritem.ejs
 * only renders section hrefs when contents is non-empty. This may be
 * a bug - sections with href but empty contents render as plain text
 * instead of links. See sidebaritem.ejs lines 19 and 35-36.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { ensureHtmlElements, fileExists, noErrorsOrWarnings } from "../../verify.ts";

const renderDir = docs("websites/website-sidebar-section-index");
const outDir = join(Deno.cwd(), renderDir, "_site");

// Test that sidebar section headers link to index.ipynb in subdirectory
// (not just that the file renders - we verify the sidebar href)
testQuartoCmd(
  "render",
  [renderDir],
  [
    noErrorsOrWarnings,
    fileExists(join(outDir, "index.html")),              // Main index page
    fileExists(join(outDir, "subdir", "index.html")),    // Subdir index from .ipynb should be rendered
    fileExists(join(outDir, "subdir", "other.html")),    // Other page should also render
    // Verify the sidebar section header links to subdir/index.html
    // This tests that indexFileHrefForDir() found the index.ipynb file
    ensureHtmlElements(
      join(outDir, "index.html"),
      ['a.sidebar-link[href="./subdir/index.html"]'],  // Sidebar should link to subdir index
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
