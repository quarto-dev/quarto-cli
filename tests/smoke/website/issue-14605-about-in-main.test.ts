/*
 * issue-14605-about-in-main.test.ts
 *
 * Regression test: about-template title block and links must render inside
 * the page's <main> landmark, not as siblings of it.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { testQuartoCmd } from "../../test.ts";
import { ensureHtmlElements, noErrorsOrWarnings } from "../../verify.ts";

const renderDir = docs("websites/issue-14605");
const outDir = join(Deno.cwd(), renderDir, "_site");

testQuartoCmd(
  "render",
  [renderDir],
  [
    noErrorsOrWarnings,
    ensureHtmlElements(join(outDir, "index.html"), [
      "main #title-block-header",
      "main .about-links",
    ]),
  ],
  {
    teardown: async () => {
      if (existsSync(outDir)) {
        await Deno.remove(outDir, { recursive: true });
      }
    },
  },
);
