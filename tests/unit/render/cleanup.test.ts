/*
 * cleanup.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert } from "testing/asserts";
import { ensureDirSync, existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { unitTest } from "../../test.ts";
import { renderCleanup } from "../../../src/command/render/cleanup.ts";
import { Format } from "../../../src/config/types.ts";
import { createMockProjectContext } from "../project/utils.ts";

// Minimal ipynb format: ipynb is a self-contained (standalone) output, so the
// self-contained cleanup path in render.ts passes the supporting dirs here.
function ipynbFormat(): Format {
  return {
    pandoc: { to: "ipynb" },
    execute: {},
    render: {},
    metadata: {},
    language: {},
  } as unknown as Format;
}

// Regression test for #14613.
//
// On a manuscript first render with freeze:auto, the ipynb completion triggers
// the self-contained supporting cleanup. The supporting dir reported by the
// engine uses forward slashes; renderCleanup normalizes the computed filesDir
// with normalizePath (backslashes on Windows). The separator mismatch made the
// equality check fail, so the parent index_files dir (instead of the narrowed
// figure-<to> dir) was handed to safeRemoveDirSync, deleting ALL figures.
// Subsequent format completions then found no index_files and copied nothing
// into _manuscript.
//
// deno-lint-ignore require-await
unitTest("renderCleanup - narrows ipynb supporting despite path separator mismatch (#14613)", async () => {
  const projectDir = Deno.makeTempDirSync({ prefix: "quarto-cleanup-test" });
  const project = createMockProjectContext({ dir: projectDir });
  try {
    const input = join(projectDir, "index.qmd");
    Deno.writeTextFileSync(input, "");

    const filesDir = join(projectDir, "index_files");
    const figureHtmlDir = join(filesDir, "figure-html");
    const figureIpynbDir = join(filesDir, "figure-ipynb");
    ensureDirSync(figureHtmlDir);
    ensureDirSync(figureIpynbDir);
    const figureHtmlPlot = join(figureHtmlDir, "plot.png");
    Deno.writeTextFileSync(figureHtmlPlot, "html-figure");
    Deno.writeTextFileSync(join(figureIpynbDir, "plot.png"), "ipynb-figure");

    // Engine reports the supporting dir with forward slashes (as knitr does).
    const supportingForwardSlash = filesDir.replaceAll("\\", "/");

    renderCleanup(
      input,
      join(projectDir, "_manuscript", "index.out.ipynb"),
      ipynbFormat(),
      project,
      [supportingForwardSlash],
    );

    // Cleanup must narrow to figure-ipynb only; the html figures the other
    // manuscript formats depend on must survive.
    assert(
      existsSync(figureHtmlPlot),
      "index_files/figure-html must survive ipynb supporting cleanup",
    );
    assert(
      !existsSync(figureIpynbDir),
      "index_files/figure-ipynb should be removed by narrowed cleanup",
    );
  } finally {
    project.cleanup();
    try {
      Deno.removeSync(projectDir, { recursive: true });
    } catch {
      // ignore
    }
  }
});
