/*
* render-embed.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { dirname, extname, join } from "../../../src/deno_ral/path.ts";
import { docs, outputForInput } from "../../utils.ts";
import {
  ensureFileRegexMatches,
  ensureHtmlElements,
  fileExists,
  noErrorsOrWarnings,
} from "../../verify.ts";
import { testRender } from "../render/render.ts";
import { walkSync } from "fs/mod.ts";

const format = "html";
const input = docs("embed/embed-qmd.qmd");
const output = outputForInput(input, format);

// Test qmd embedding
// The notebook preview that is generated
const nbOutput = join(dirname(output.outputPath), "notebook.embed-preview.html");
const nbSupporting = join(dirname(nbOutput), "notebook.embed_files");

testRender(input, format, false, [
  noErrorsOrWarnings,
  // Make sure that the preview is generated as expected
  fileExists(nbOutput),
  fileExists(nbSupporting),
  ensureHtmlElements(output.outputPath, [
    // Make sure the embeds produce expected output
    "#fig-mtcars",
    // Make sure notebook links are present
    "a.quarto-notebook-link",
    ".quarto-alternate-notebooks a",
  ]),
  // Ensure the captions look good
  ensureFileRegexMatches(output.outputPath, [
    /Figure.*1:/,
  ]),
], {
  teardown: () => {
    // clean up the notebook that is referenced by `embed-qmd-qmd`
    Deno.removeSync(nbOutput);
    Deno.removeSync(nbSupporting, { recursive: true });

    return Promise.resolve();
  },
});

// Test ipynb emebedding
// The notebook preview that is generated
const ipynbInput = docs("embed/embed-ipynb.qmd");
const ipynbOutput = outputForInput(ipynbInput, format);

const ipynbPreviewNb = join(
  dirname(ipynbOutput.outputPath),
  "penguins-preview.html",
);
const ipynbPreviewSupporting = join(
  dirname(ipynbOutput.outputPath),
  "penguins_files",
);

const ipynbPreviewRendered = join(
  dirname(ipynbOutput.outputPath),
  "penguins.out.ipynb",
);

testRender(ipynbInput, format, false, [
  noErrorsOrWarnings,
  // Make sure that the preview is generated as expected
  fileExists(ipynbPreviewNb),
  fileExists(ipynbPreviewSupporting),
  fileExists(ipynbPreviewRendered),
  ensureHtmlElements(ipynbOutput.outputPath, [
    // Make sure the embeds produce expected output
    "#fig-bill-scatter",
    `[data-tags='["bill-ratio"]']`,
    "#fig-bill-marginal",
    "#fig-bill-marginal-1",
    "#fig-bill-marginal-2",
    "#cell-species-counts",
    "#cell-species-counts .sourceCode",
    // Make sure notebook links are present
    "a.quarto-notebook-link",
    ".quarto-alternate-notebooks a",
  ]),
  // Ensure the captions look good
  ensureFileRegexMatches(ipynbOutput.outputPath, [
    /Figure.*1:/,
    /Figure.*2:/,
  ]),
], {
  teardown: () => {
    // clean up the notebook that is referenced by `embed-qmd-qmd`
    Deno.removeSync(ipynbPreviewNb);
    Deno.removeSync(ipynbPreviewSupporting, { recursive: true });
    Deno.removeSync(ipynbPreviewRendered);

    return Promise.resolve();
  },
});

// Test different echo settings (bug 8472)
const docInput = docs("embed/qmd-embed/index.qmd");
const docOutput = outputForInput(docInput, "html");
testRender(docInput, "html", false, [
  noErrorsOrWarnings,
  ensureHtmlElements(docOutput.outputPath, [
    // Make sure the embeds produce expected output
    "#fig-polar",
    "#fig-index-plot",
    // Make sure notebook links are present
    "a.quarto-notebook-link",
    ".quarto-alternate-notebooks a",
  ]),
  // Ensure the captions look good
  ensureFileRegexMatches(docOutput.outputPath, [
    /Figure.*1:/,
    /Figure.*2:/,
  ]),
], {
  teardown: () => {
    // Only qmds should be left in this directory
    const dir = join(Deno.cwd(), dirname(docInput));

    const cleanup = ["notebook.embed_files", "notebook.embed-preview.html", "notebook2.embed_files", "notebook2.embed-preview.html"];
    cleanup.forEach((path) => {
      Deno.removeSync(join(dir, path), {recursive: true});
    })
    return Promise.resolve();
  },
});

