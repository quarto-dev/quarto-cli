/*
* render-site.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { existsSync } from "../../../src/deno_ral/fs.ts";
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

// A qmd source embed gets a preview page and a downloadable copy of the source.
const siteQmdEmbed = join(docs("site-qmd-embed"), "_site");
// A cached embed rendering from a previous render changes what is emitted
// (see #10756), so each run starts and ends without the scratch directory.
const removeQmdEmbedScratch = () => {
  const scratch = join(docs("site-qmd-embed"), ".quarto");
  if (existsSync(scratch)) {
    Deno.removeSync(scratch, { recursive: true });
  }
  return Promise.resolve();
};

testSite(
  docs("site-qmd-embed/index.qmd"),
  docs("site-qmd-embed/index.qmd"),
  [
    ".quarto-embed-nb-cell", // Embed is present
  ],
  [],
  { setup: removeQmdEmbedScratch, teardown: removeQmdEmbedScratch },
  fileExists(join(siteQmdEmbed, "computations.embed-preview.html")),
  fileExists(join(siteQmdEmbed, "computations.qmd")),
);
