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
// 1. Testing listing type


verify.push(ensureHtmlElements(htmlOutput, [
  // 1. Testing listing type
  "div#listing-reports table.quarto-listing-table",
  "div#listing-other-reports .quarto-listing-default",
  "div#listing-notes .quarto-grid-item",
  // 2. Testing image-placeholder is correctly chosen
  "div#listing-other-reports .quarto-post div.thumbnail img[src^='other-report.png']",
  "div#listing-notes .quarto-grid-item .card-img-top img[src^='meeting-notes.png']",
  // 3. Testing that empty div is used when no image is present
  "div#listing-reports span.listing-image div.listing-item-img-placeholder",
  // 4. Testing that `.preview-image` is correctly taken
  'div#listing-other-reports .quarto-post div.thumbnail img[src$="2\.png"]',
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
