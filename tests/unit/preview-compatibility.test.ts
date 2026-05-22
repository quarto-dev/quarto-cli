/*
 * preview-compatibility.test.ts
 *
 * Tests that previewRenderRequestIsCompatible detects a frontmatter
 * format change on the first request after the edit. Regression test
 * for #14533.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { previewRenderRequestIsCompatible } from "../../src/command/preview/preview.ts";
import { singleFileProjectContext } from "../../src/project/types/single-file/single-file.ts";
import { fileExecutionEngineAndTarget } from "../../src/execute/engine.ts";
import { notebookContext } from "../../src/render/notebook/notebook-context.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";
import { HttpDevServerRenderMonitor } from "../../src/core/http-devserver.ts";

unitTest(
  "previewRenderRequestIsCompatible - detects format change in frontmatter on first request (#14533)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
    const file = join(tmpDir, "test.qmd");

    try {
      // Initial state: format: html.
      Deno.writeTextFileSync(
        file,
        "---\ntitle: test\nformat: html\n---\n",
      );

      const nbContext = notebookContext();
      const project = await singleFileProjectContext(file, nbContext);

      // Prime fileInformationCache by resolving the file's current
      // engine + target once — this is what the first render does
      // before any compatibility check is exercised.
      await fileExecutionEngineAndTarget(file, undefined, project);

      // User edits frontmatter to a new format.
      Deno.writeTextFileSync(
        file,
        "---\ntitle: test\nformat: typst\n---\n",
      );

      // Compatibility check from the Positron path: request.format is
      // undefined, the preview process was started with flags.to = "html".
      // The check must return false so the IDE restarts the process.
      const compatible = await previewRenderRequestIsCompatible(
        { version: 2, path: file, format: undefined },
        project,
        "html",
      );

      assertEquals(
        compatible,
        false,
        "Compatibility check must detect format change on first request",
      );
    } finally {
      Deno.removeSync(tmpDir, { recursive: true });
    }
  },
);

unitTest(
  "previewRenderRequestIsCompatible - unchanged frontmatter stays compatible",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
    const file = join(tmpDir, "test.qmd");

    try {
      Deno.writeTextFileSync(
        file,
        "---\ntitle: test\nformat: html\n---\n",
      );

      const nbContext = notebookContext();
      const project = await singleFileProjectContext(file, nbContext);

      // Prime cache.
      await fileExecutionEngineAndTarget(file, undefined, project);

      // No frontmatter edit — still html, process locked to html.
      const compatible = await previewRenderRequestIsCompatible(
        { version: 2, path: file, format: undefined },
        project,
        "html",
      );

      assertEquals(
        compatible,
        true,
        "Compatibility check must not trigger spurious restart when format unchanged",
      );
    } finally {
      Deno.removeSync(tmpDir, { recursive: true });
    }
  },
);

unitTest(
  "previewRenderRequestIsCompatible - detects format change in reverse direction (typst → html)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
    const file = join(tmpDir, "test.qmd");

    try {
      Deno.writeTextFileSync(
        file,
        "---\ntitle: test\nformat: typst\n---\n",
      );

      const nbContext = notebookContext();
      const project = await singleFileProjectContext(file, nbContext);

      await fileExecutionEngineAndTarget(file, undefined, project);

      Deno.writeTextFileSync(
        file,
        "---\ntitle: test\nformat: html\n---\n",
      );

      const compatible = await previewRenderRequestIsCompatible(
        { version: 2, path: file, format: undefined },
        project,
        "typst",
      );

      assertEquals(
        compatible,
        false,
        "Compatibility check must detect format change regardless of direction",
      );
    } finally {
      Deno.removeSync(tmpDir, { recursive: true });
    }
  },
);

unitTest(
  "previewRenderRequestIsCompatible - defers cache invalidation while a render is in flight",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
    const file = join(tmpDir, "test.qmd");

    try {
      Deno.writeTextFileSync(
        file,
        "---\ntitle: test\nformat: html\n---\n",
      );

      const nbContext = notebookContext();
      const project = await singleFileProjectContext(file, nbContext);

      // Prime cache with format: html.
      await fileExecutionEngineAndTarget(file, undefined, project);

      // Edit frontmatter mid-flight.
      Deno.writeTextFileSync(
        file,
        "---\ntitle: test\nformat: typst\n---\n",
      );

      // Mark a render as in flight. The compatibility check must NOT
      // invalidate fileInformationCache while this is true, otherwise it
      // would race with the in-flight render's transient .quarto_ipynb.
      HttpDevServerRenderMonitor.onRenderStart();
      try {
        const compatible = await previewRenderRequestIsCompatible(
          { version: 2, path: file, format: undefined },
          project,
          "html",
        );

        // Cache was NOT refreshed, so the cached format (html) still
        // matches flags.to. The stale verdict is the safety trade-off:
        // the next compat check after the in-flight render completes
        // will see the new format.
        assertEquals(
          compatible,
          true,
          "Compatibility check must defer invalidation during in-flight render",
        );
      } finally {
        HttpDevServerRenderMonitor.onRenderStop(true);
      }
    } finally {
      Deno.removeSync(tmpDir, { recursive: true });
    }
  },
);

unitTest(
  "previewRenderRequestIsCompatible - file path with spaces",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
    const file = join(tmpDir, "my doc.qmd");

    try {
      Deno.writeTextFileSync(
        file,
        "---\ntitle: test\nformat: html\n---\n",
      );

      const nbContext = notebookContext();
      const project = await singleFileProjectContext(file, nbContext);

      await fileExecutionEngineAndTarget(file, undefined, project);

      Deno.writeTextFileSync(
        file,
        "---\ntitle: test\nformat: typst\n---\n",
      );

      const compatible = await previewRenderRequestIsCompatible(
        { version: 2, path: file, format: undefined },
        project,
        "html",
      );

      assertEquals(
        compatible,
        false,
        "Compatibility check must handle paths containing spaces correctly",
      );
    } finally {
      Deno.removeSync(tmpDir, { recursive: true });
    }
  },
);
