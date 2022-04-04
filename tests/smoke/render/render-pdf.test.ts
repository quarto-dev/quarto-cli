/*
* render-pdf.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import { removePackage } from "../../../src/command/render/latexmk/texlive.ts";
import { which } from "../../../src/core/path.ts";
import { docs } from "../../utils.ts";

import { testRender } from "./render.ts";

// Simple rendering tests
testRender(docs("test.qmd"), "pdf", true);
testRender(docs("latexmk/bibliography-biblatex.Rmd"), "pdf", true);
testRender(docs("latexmk/bibliography-citeproc.Rmd"), "pdf", true);
testRender(docs("latexmk/bibliography-natbib.Rmd"), "pdf", true);
testRender(docs("latexmk/make-index.Rmd"), "pdf", true);
testRender(docs("latexmk/make-index-custom.Rmd"), "pdf", true);

// Package installation tests
/*
testRender(docs("latexmk/all.Rmd"), "pdf", true, [], {
  setup: async () => {
    await ensurePackageRemoved("fontawesome5");
    await ensurePackageRemoved("makeindex");
    await ensurePackageRemoved("sansmath");
    await ensurePackageRemoved("xindy");
  },
});

testRender(docs("latexmk/babel.Rmd"), "pdf", true, [], {
  setup: async () => {
    await ensurePackageRemoved("hyphen-portuguese");
    await ensurePackageRemoved("babel-portuges");
  },
});


testRender(docs("latexmk/estopdf.Rmd"), "pdf", true, [], {
  prereq: async () => {
    const hasGhostscript = await which("gs") !== undefined;
    return hasGhostscript;
  },
  setup: async () => {
    await ensurePackageRemoved("epstopdf");
  },
  teardown: () => {
    // clean intermediary that is produced:
    const estopdf = docs("latexmk/estosoccer-eps-converted-to.pdf");
    if (existsSync(estopdf)) {
      Deno.removeSync(estopdf);
    }
    return Promise.resolve();
  },
});

testRender(docs("latexmk/make-index-custom.Rmd"), "pdf", true, [], {
  setup: async () => {
    await ensurePackageRemoved("fontawesome5");
    Deno.copyFileSync(
      docs("latexmk/missfont.txt"),
      docs("latexmk/missfont.log"),
    );
  },
});

*/
async function ensurePackageRemoved(pkg: string) {
  try {
    await removePackage(pkg);
  } catch {
    // do nothing
  }
}
