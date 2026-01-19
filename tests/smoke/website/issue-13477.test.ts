/*
 * issue-13477.test.ts
 *
 * Verifies navbar and sidebar title control options.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrorsOrWarnings, ensureHtmlElementContents, ensureHtmlElements } from "../../verify.ts";

// 1. navbar: false, sidebar: undefined -> should show in sidebar, not navbar
const dir1 = docs("websites/issue-13477/navbar-false-sidebar-undefined");
const outDir1 = join(Deno.cwd(), dir1, "_site");
const index1 = join(outDir1, "index.html");

testQuartoCmd(
  "render",
  [dir1],
  [
    noErrorsOrWarnings,
    fileExists(index1),
    ensureHtmlElementContents(index1, {
      selectors: [".sidebar-title"],
      matches: ["My Website"],
    }),
    ensureHtmlElements(index1, [], [".navbar-title"]),
  ],
  {
    teardown: async () => {
      if (existsSync(outDir1)) {
        await Deno.remove(outDir1, { recursive: true });
      }
    },
  },
);

// 2. navbar: true, sidebar: true -> should show in both
const dir2 = docs("websites/issue-13477/navbar-true-sidebar-true");
const outDir2 = join(Deno.cwd(), dir2, "_site");
const index2 = join(outDir2, "index.html");

testQuartoCmd(
  "render",
  [dir2],
  [
    noErrorsOrWarnings,
    fileExists(index2),
    ensureHtmlElementContents(index2, {
      selectors: [".sidebar-title"],
      matches: ["My Website"],
    }),
    ensureHtmlElementContents(index2, {
      selectors: [".navbar-title"],
      matches: ["My Website"],
    }),
  ],
  {
    teardown: async () => {
      if (existsSync(outDir2)) {
        await Deno.remove(outDir2, { recursive: true });
      }
    },
  },
);

// 3. book: sidebar logo, sidebar title undefined -> should show in sidebar (book exception)
const dir3 = docs("books/issue-13477/book-sidebar-logo");
const outDir3 = join(Deno.cwd(), dir3, "_book");
const index3 = join(outDir3, "index.html");

testQuartoCmd(
  "render",
  [dir3],
  [
    noErrorsOrWarnings,
    fileExists(index3),
    ensureHtmlElementContents(index3, {
      selectors: [".sidebar-title"],
      matches: ["My Book"],
    }),
  ],
  {
    teardown: async () => {
      if (existsSync(outDir3)) {
        await Deno.remove(outDir3, { recursive: true });
      }
    },
  },
);

// 4. custom titles
const dir4 = docs("websites/issue-13477/custom-titles");
const outDir4 = join(Deno.cwd(), dir4, "_site");
const index4 = join(outDir4, "index.html");

testQuartoCmd(
  "render",
  [dir4],
  [
    noErrorsOrWarnings,
    fileExists(index4),
    ensureHtmlElementContents(index4, {
      selectors: [".navbar-title"],
      matches: ["Custom Nav"],
    }),
    ensureHtmlElementContents(index4, {
      selectors: [".sidebar-title"],
      matches: ["Custom Side"],
    }),
  ],
  {
    teardown: async () => {
      if (existsSync(outDir4)) {
        await Deno.remove(outDir4, { recursive: true });
      }
    },
  },
);

// 5. no titles
const dir5 = docs("websites/issue-13477/no-titles");
const outDir5 = join(Deno.cwd(), dir5, "_site");
const index5 = join(outDir5, "index.html");

testQuartoCmd(
  "render",
  [dir5],
  [
    noErrorsOrWarnings,
    fileExists(index5),
    ensureHtmlElements(index5, [], [".navbar-title", ".sidebar-title"]),
  ],
  {
    teardown: async () => {
      if (existsSync(outDir5)) {
        await Deno.remove(outDir5, { recursive: true });
      }
    },
  },
);
