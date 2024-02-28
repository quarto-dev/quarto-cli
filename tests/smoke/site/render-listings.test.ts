/*
* render-listings.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { dirname, join } from "../../../src/deno_ral/path.ts";
import { testQuartoCmd, Verify } from "../../test.ts";

import { docs } from "../../utils.ts";
import { ensureHtmlElements, fileExists } from "../../verify.ts";

const input = docs("listings/index.qmd");
const outputDir = join(docs("listings"), "_site");
const htmlOutput = join(
  outputDir,
  "index.html",
);

const verify: Verify[] = [];
verify.push(fileExists(htmlOutput));
verify.push(ensureHtmlElements(htmlOutput, [
  "div#listing-notes .quarto-grid-item",
  "div#listing-reports table.quarto-listing-table",
]));

testQuartoCmd(
  "render",
  [
    dirname(input),
  ],
  verify,
  {
    name: "Site Render",
    teardown: async () => {
      await Deno.remove(outputDir, { recursive: true });
    },
  },
);
