/*
* render-site.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";
import { fileExists } from "../../verify.ts";
import { testSite } from "./site.ts";

// The test runs from tests/, outside the project directory, so this also
// covers notebook preview files reaching _site when cwd != project dir.
const siteNotebooks = join(docs("site"), "_site", "notebooks");

testSite(
  docs("site/index.qmd"),
  docs("site/index.qmd"),
  [
    ".quarto-embed-nb-cell", // Embed is present
  ],
  [],
  undefined,
  fileExists(join(siteNotebooks, "computations-preview.html")),
  fileExists(join(siteNotebooks, "computations.out.ipynb")),
);
