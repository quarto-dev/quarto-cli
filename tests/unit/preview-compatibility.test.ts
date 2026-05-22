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
import { assertEquals, assertStrictEquals } from "testing/asserts";
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

      // Snapshot the cache entry reference before the compatibility
      // check. If the gate fires correctly, the entry is left alone; if
      // the gate is bypassed, invalidateForFile deletes the entry and
      // previewFormat repopulates it with a NEW FileInformation object.
      const cacheEntryBefore = project.fileInformationCache?.get(file);

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

        // Reference equality proves the gate skipped invalidate. Without
        // the gate, fileInformationCache.delete(key) would have removed
        // this entry and previewFormat's downstream call to
        // fileExecutionEngineAndTarget would have produced a fresh
        // FileInformation object — a different reference.
        const cacheEntryAfter = project.fileInformationCache?.get(file);
        assertStrictEquals(
          cacheEntryAfter,
          cacheEntryBefore,
          "Cache entry must not be replaced during in-flight render",
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
  "HttpDevServerRenderMonitor - isRendering tracks overlapping renders via counter",
  // deno-lint-ignore require-await
  async () => {
    // submitRender in src/project/serve/render.ts calls onRenderStart
    // synchronously at queue time, but onRenderStop only fires when
    // each render's outer promise resolves. With two queued renders,
    // a single-timestamp tracker would clear the gate when render A
    // finishes even though render B is still queued or running —
    // re-introducing the race the in-flight gate is meant to prevent.
    // The counter approach must keep isRendering() true until ALL
    // submitted renders have stopped.
    const initialInFlight = HttpDevServerRenderMonitor.isRendering();
    let openStarts = 0;
    try {
      HttpDevServerRenderMonitor.onRenderStart();
      openStarts++;
      HttpDevServerRenderMonitor.onRenderStart();
      openStarts++;

      assertEquals(
        HttpDevServerRenderMonitor.isRendering(),
        true,
        "two in-flight renders must report isRendering=true",
      );

      HttpDevServerRenderMonitor.onRenderStop(true);
      openStarts--;

      assertEquals(
        HttpDevServerRenderMonitor.isRendering(),
        true,
        "isRendering must remain true after one stop while another render is still in flight",
      );

      HttpDevServerRenderMonitor.onRenderStop(true);
      openStarts--;

      assertEquals(
        HttpDevServerRenderMonitor.isRendering(),
        initialInFlight,
        "isRendering must return to initial state after both stops",
      );
    } finally {
      // Drain any starts not yet matched by a stop (assertion failure
      // mid-test). onRenderStop is a no-op when the counter is already 0.
      while (openStarts > 0) {
        HttpDevServerRenderMonitor.onRenderStop(true);
        openStarts--;
      }
    }
  },
);

unitTest(
  "previewRenderRequestIsCompatible - version 1 short-circuits without consulting project",
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

      // v1 requests originate from RStudio's preview pipeline, which
      // manages its own compatibility state. The function must return
      // true without consulting the project or the file's frontmatter.
      // Passing a format that would normally fail (typst vs html
      // frontmatter) proves the short-circuit ignores format entirely.
      const compatible = await previewRenderRequestIsCompatible(
        { version: 1, path: file, format: undefined },
        project,
        "typst",
      );

      assertEquals(
        compatible,
        true,
        "v1 must return true unconditionally regardless of format mismatch",
      );
    } finally {
      Deno.removeSync(tmpDir, { recursive: true });
    }
  },
);

unitTest(
  "previewRenderRequestIsCompatible - pinned request.format matches flags.to without invalidating cache",
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

      await fileExecutionEngineAndTarget(file, undefined, project);
      const cacheEntryBefore = project.fileInformationCache?.get(file);

      // When the caller pins request.format, previewFormat short-circuits
      // (returns the pinned value directly) without calling renderFormats
      // or consulting fileInformationCache. The compatibility verdict
      // therefore depends only on the pinned format vs flags.to.
      const compatible = await previewRenderRequestIsCompatible(
        { version: 2, path: file, format: "html" },
        project,
        "html",
      );

      assertEquals(
        compatible,
        true,
        "Pinned format matching flags.to must return true",
      );

      // Reference equality proves the pinned-format path skipped
      // invalidate. If invalidateForFile fired, the entry would be
      // deleted and downstream code would have repopulated it with a
      // fresh object — a different reference.
      const cacheEntryAfter = project.fileInformationCache?.get(file);
      assertStrictEquals(
        cacheEntryAfter,
        cacheEntryBefore,
        "Pinned-format path must not invalidate fileInformationCache",
      );
    } finally {
      Deno.removeSync(tmpDir, { recursive: true });
    }
  },
);

unitTest(
  "previewRenderRequestIsCompatible - pinned request.format differing from flags.to returns false without invalidating cache",
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

      await fileExecutionEngineAndTarget(file, undefined, project);
      const cacheEntryBefore = project.fileInformationCache?.get(file);

      // Pinned format that disagrees with the running preview process's
      // flags.to. The verdict reflects the pinned value directly; the
      // file's frontmatter (also html) is not consulted.
      const compatible = await previewRenderRequestIsCompatible(
        { version: 2, path: file, format: "typst" },
        project,
        "html",
      );

      assertEquals(
        compatible,
        false,
        "Pinned format differing from flags.to must return false",
      );

      // Same cache invariant as the match case: pinned-format path must
      // not touch fileInformationCache regardless of match/mismatch.
      // Without this assertion, a regression that invalidated and
      // repopulated the cache on the mismatch path would still produce
      // the correct boolean (typst !== html) and ship undetected.
      const cacheEntryAfter = project.fileInformationCache?.get(file);
      assertStrictEquals(
        cacheEntryAfter,
        cacheEntryBefore,
        "Pinned-format path must not invalidate fileInformationCache",
      );
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
