/*
 * render-shared-output-dir.test.ts
 *
 * Regression test for posit-dev/positron#13370 / quarto-dev/quarto-cli#14489.
 *
 * When `quarto preview file.qmd --output-dir <dir>` runs in a directory
 * without _quarto.yml, preview pre-creates a singleFileProjectContext and
 * passes it to render() as pContext. The synthetic-project trigger in
 * render-shared.ts only fired when pContext was null, so the path fell
 * through to validateDocumentRenderFlags() and threw.
 *
 * This test mimics that exact pattern and asserts no throw + output
 * landed in --output-dir.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { existsSync } from "../../src/deno_ral/fs.ts";
import { render } from "../../src/command/render/render-shared.ts";
import { singleFileProjectContext } from "../../src/project/types/single-file/single-file.ts";
import { notebookContext } from "../../src/render/notebook/notebook-context.ts";
import { renderServices } from "../../src/command/render/render-services.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";

unitTest(
  "render() with --output-dir succeeds when caller pre-passes a single-file context (#14489)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tempBase = Deno.makeTempDirSync({ prefix: "quarto_test_outdir_" });
    const inputDir = join(tempBase, "src");
    const outputDir = join(tempBase, "out");
    Deno.mkdirSync(inputDir);
    Deno.mkdirSync(outputDir);

    const inputFile = join(inputDir, "test.qmd");
    Deno.writeTextFileSync(
      inputFile,
      "---\ntitle: Test\nformat: html\n---\n\nHello world.\n",
    );

    const nbCtx = notebookContext();
    const services = renderServices(nbCtx);

    const renderOptions = {
      services,
      flags: { outputDir },
      pandocArgs: [],
    };

    // Mimic preview's pattern: pre-create singleFileProjectContext, pass as pContext.
    const project = await singleFileProjectContext(inputFile, nbCtx, renderOptions);

    try {
      // Before the fix this throws "The --output-dir flag can only be used
      // when rendering projects."
      await render(inputFile, renderOptions, project);

      assert(
        existsSync(join(outputDir, "test.html")),
        `Expected output HTML at ${join(outputDir, "test.html")} after render with --output-dir`,
      );
    } finally {
      services.cleanup?.();
      try {
        Deno.removeSync(tempBase, { recursive: true });
      } catch {
        // best-effort cleanup
      }
    }
  },
);
