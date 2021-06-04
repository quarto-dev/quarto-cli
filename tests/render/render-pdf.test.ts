/*
* render-pdf.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import { removePackage } from "../../src/command/render/latexmk/texlive.ts";
import { which } from "../../src/core/path.ts";

import { testRender } from "../render.ts";
import { noSupportingFiles, outputCreated } from "../verify.ts";

testRender("docs/latexmk/all.Rmd", "pdf", [
  outputCreated,
  noSupportingFiles,
], async () => {
  await ensurePackageRemoved("fontawesome");
  await ensurePackageRemoved("makeindex");
  await ensurePackageRemoved("sansmath");
  await ensurePackageRemoved("xindy");
});

testRender("docs/latexmk/plain.Rmd", "pdf", [
  outputCreated,
  noSupportingFiles,
]);

testRender("docs/latexmk/bibliography-biblatex.Rmd", "pdf", [
  outputCreated,
  noSupportingFiles,
]);

testRender("docs/latexmk/bibliography-citeproc.Rmd", "pdf", [
  outputCreated,
  noSupportingFiles,
]);

testRender("docs/latexmk/bibliography-natbib.Rmd", "pdf", [
  outputCreated,
  noSupportingFiles,
]);

testRender("docs/latexmk/babel.Rmd", "pdf", [
  outputCreated,
  noSupportingFiles,
], async () => {
  await ensurePackageRemoved("hyphen-portuguese");
  await ensurePackageRemoved("babel-portuges");
});

testRender("docs/latexmk/estopdf.Rmd", "pdf", [
  outputCreated,
  noSupportingFiles,
], async () => {
  await ensurePackageRemoved("epstopdf");
}, () => {
  // clean intermediary that is produced:
  const estopdf = "docs/latexmk/estosoccer-eps-converted-to.pdf";
  if (existsSync(estopdf)) {
    Deno.removeSync(estopdf);
  }
  return Promise.resolve();
}, async () => {
  const hasGhostscript = await which("gs") !== undefined;
  return hasGhostscript;
});

testRender("docs/latexmk/make-index.Rmd", "pdf", [
  outputCreated,
  noSupportingFiles,
]);

testRender("docs/latexmk/make-index-custom.Rmd", "pdf", [
  outputCreated,
  noSupportingFiles,
]);

testRender("docs/latexmk/make-index-custom.Rmd", "pdf", [
  outputCreated,
  noSupportingFiles,
], async () => {
  await ensurePackageRemoved("fontawesome");
  Deno.copyFileSync("docs/latexmk/missfont.txt", "docs/latexmk/missfont.log");
});

async function ensurePackageRemoved(pkg: string) {
  try {
    await removePackage(pkg);
  } catch {
    // do nothing
  }
}
