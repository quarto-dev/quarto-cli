import { removePackage } from "../src/command/render/latekmk/texlive.ts";
import { testRender } from "./render.ts";

Deno.test("render: (all)", async () => {
  // Uninstall the cjk pacakge
  await ensurePackageRemoved("fontawesome");
  await ensurePackageRemoved("makeindex");
  await ensurePackageRemoved("sansmath");
  await ensurePackageRemoved("xindy");

  await testRender("docs/latexmk/all.Rmd", false, "pdf");
});

Deno.test("render: plain pdf", async () => {
  await testRender("docs/latexmk/plain.Rmd", false, "pdf");
});

Deno.test("render: biblatex pdf", async () => {
  await testRender("docs/latexmk/bibliography-biblatex.Rmd", false, "pdf");
});

Deno.test("render: citeproc pdf", async () => {
  await testRender("docs/latexmk/bibliography-citeproc.Rmd", false, "pdf");
});

Deno.test("render: natbib pdf", async () => {
  await testRender("docs/latexmk/bibliography-natbib.Rmd", false, "pdf");
});

Deno.test("render: babel pdf", async () => {
  ensurePackageRemoved("hyphen-portuguese");
  ensurePackageRemoved("babel-portuges");

  await testRender("docs/latexmk/babel.Rmd", false, "pdf");
});

Deno.test("render:esto pdf", async () => {
  ensurePackageRemoved("epstopdf");

  await testRender("docs/latexmk/estopdf.Rmd", false, "pdf");
});

Deno.test("render:make index", async () => {
  await testRender("docs/latexmk/make-index.Rmd", false, "pdf");
});

Deno.test("render:make index (custom)", async () => {
  await testRender("docs/latexmk/make-index-custom.Rmd", false, "pdf");
});

Deno.test("render:missing font", async () => {
  ensurePackageRemoved("fontawesome");
  Deno.copyFileSync("docs/latexmk/missfont.txt", "docs/latexmk/missfont.log");
  await testRender("docs/latexmk/missing-font.Rmd", false, "pdf");
});

async function ensurePackageRemoved(pkg: string) {
  try {
    await removePackage("fontawesome");
  } catch (e) {
    // do nothing
  }
}
