/*
 * single-file-input-abs-12401.test.ts
 *
 * Regression test for quarto-dev/quarto-cli#12401.
 *
 * Single-file (non-project) rendering used to build an ExecutionTarget whose
 * `source`/`input` were the caller's relative path, while project rendering
 * normalized to an absolute path (via project.ts normalizeFiles). That
 * inconsistency leaked into `target.source`-derived values — notably
 * QUARTO_DOCUMENT_PATH (src/execute/environment.ts sets it to
 * dirname(target.source)) — which was relative for single files but absolute
 * inside a project.
 *
 * fileExecutionEngineAndTarget now normalizes the path to absolute at that
 * single convergence point, so single-file and project renders agree: the
 * target is always absolute.
 *
 * Deterministic and engine-free: building the target only reads markdown/YAML.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import { isAbsolute, join, relative } from "../../src/deno_ral/path.ts";
import { withTempDir } from "../utils.ts";
import { singleFileProjectContext } from "../../src/project/types/single-file/single-file.ts";
import { notebookContext } from "../../src/render/notebook/notebook-context.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";

unitTest(
  "single-file render builds an absolute target from a relative arg (#12401)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tempBase) => {
      const absFile = join(tempBase, "doc.qmd");
      Deno.writeTextFileSync(absFile, "---\ntitle: Doc\n---\n\nHello.\n");

      // A cwd-relative path — the single-file (non-project) render path used to
      // keep this verbatim in target.source/input, diverging from project
      // renders (which are absolute).
      const relFile = relative(Deno.cwd(), absFile);

      const nbContext = notebookContext();
      const project = await singleFileProjectContext(relFile, nbContext);

      try {
        const { target } = await project.fileExecutionEngineAndTarget(relFile);

        // Before the fix, target.source/input were the relative arg, so
        // QUARTO_DOCUMENT_PATH (dirname(target.source)) diverged from project
        // renders. They are now absolute in both cases.
        assert(
          isAbsolute(target.source),
          `Expected an absolute target.source for single-file render, got ` +
            `${target.source} (regression #12401)`,
        );
        assert(
          isAbsolute(target.input),
          `Expected an absolute target.input for single-file render, got ` +
            `${target.input} (regression #12401)`,
        );
      } finally {
        project.cleanup();
      }
    }, "quarto_test_12401_");
  },
);
