/*
 * preview-subdir-knitr-cwd.test.ts
 *
 * Regression test for quarto-dev/quarto-cli#14683.
 *
 * When previewing a knitr-engine document that lives in a project
 * subdirectory, with the working directory set to that subdirectory and the
 * input passed as a bare filename (the shape RStudio's Render button uses),
 * the render failed with:
 *
 *   Error in rmarkdown:::abs_path(input) :
 *     The file 'claudetest.qmd' does not exist.
 *
 * Root cause: preview resolves the preview format first (renderFormats /
 * previewFormat) using the cwd-relative filename, which seeds the shared
 * ProjectContext's fileInformationCache with an ExecutionTarget whose `input`
 * is that relative string. The cache is keyed by normalized (absolute) path, so
 * the later renderProject() call — which passes the absolute path — hits the
 * stale cache entry and inherits the relative `input`. The knitr subprocess
 * runs with cwd = project dir, where the subdirectory-relative filename does
 * not resolve, so abs_path() throws.
 *
 * fileExecutionEngineAndTarget now normalizes the path to absolute at that
 * single convergence point, so the cached target is absolute regardless of how
 * the caller spelled the path.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import {
  dirname,
  fromFileUrl,
  isAbsolute,
  join,
} from "../../src/deno_ral/path.ts";
import { existsSync } from "../../src/deno_ral/fs.ts";
import { which } from "../../src/core/path.ts";
import { projectContext } from "../../src/project/project-context.ts";
import { singleFileProjectContext } from "../../src/project/types/single-file/single-file.ts";
import { notebookContext } from "../../src/render/notebook/notebook-context.ts";
import { renderServices } from "../../src/command/render/render-services.ts";
import { renderFormats } from "../../src/command/render/render-contexts.ts";
import { previewFormat } from "../../src/command/preview/preview.ts";
import { renderProject } from "../../src/command/render/project.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";

// --- End-to-end fixture (RED-1) ---
// The harness applies TestContext.cwd() BEFORE setup(), so the working
// directory must already exist when it chdirs in — create the tree in the
// prereq check itself (the harness runs prereq before cwd()/setup(), and
// skips cwd()/setup()/teardown() together when prereq is false), so nothing
// is left on disk when Rscript is absent and the test is skipped. This test
// keeps the literal RStudio shape: cwd = the doc's subdirectory, input = the
// bare filename.
let e2eBase: string;
let e2eProjDir: string;
let e2eLabsDir: string;

unitTest(
  "preview of a knitr subdir doc from that subdir's cwd renders (#14683)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    // cwd is e2eLabsDir (set by the harness via TestContext.cwd).
    const file = "claudetest.qmd";

    const nbContext = notebookContext();
    const project = (await projectContext(dirname(file), nbContext)) ??
      (await singleFileProjectContext(file, nbContext));

    try {
      // Mimic preview cmd.ts: resolve the preview format first, using the
      // bare filename. This seeds the shared context's fileInformationCache.
      const services = renderServices(nbContext);
      try {
        const formats = await renderFormats(file, services, "all", project);
        await previewFormat(file, project, undefined, formats);
      } finally {
        services.cleanup();
      }

      // Now render as preview does, passing the bare filename.
      const renderServices2 = renderServices(nbContext);
      try {
        const result = await renderProject(
          project,
          {
            services: renderServices2,
            progress: false,
            useFreezer: false,
            flags: { to: "html" },
            pandocArgs: [],
            previewServer: true,
          },
          [file],
        );

        // The behavioral signal for this bug is whether the knitr render
        // actually produced output. With the bug, the R subprocess fails at
        // rmarkdown:::abs_path(input) (execute.R) before Pandoc runs, so no
        // HTML is written. Surface renderProject's error (if any) first, since
        // the missing-file assertion below would otherwise mask it.
        const outputHtml = join(e2eProjDir, "_site", "labs", "claudetest.html");
        assert(
          existsSync(outputHtml),
          "Expected rendered HTML at _site/labs/claudetest.html — knitr render " +
            "of the subdir doc failed to produce output (regression #14683). " +
            `renderProject error: ${result.error?.message} ${result.error?.stack}`,
        );

        // Mere existence is not enough: prove the knitr chunk actually
        // executed. `1 + 1` yields `[1] 2` in the rendered output, confirming
        // the R engine ran end-to-end (the exact path the bug broke).
        const html = Deno.readTextFileSync(outputHtml);
        assert(
          /\[1\]\s*2/.test(html),
          "Rendered HTML is missing the knitr chunk result ([1] 2) — the R " +
            "engine did not execute the code cell (regression #14683)",
        );

        // QUARTO_DOCUMENT_PATH (from target.source) must point at the doc's
        // subdirectory (…/testsite/labs), not "." or the project root. A
        // relative source would make it wrong here (#12401).
        assert(
          /testsite[\\/]labs/.test(html),
          "QUARTO_DOCUMENT_PATH did not resolve to the doc's subdirectory " +
            "(expected a path containing testsite/labs) — regression #14683 / #12401",
        );

        assert(
          !result.error,
          `renderProject reported an error: ${result.error?.message}`,
        );
      } finally {
        renderServices2.cleanup();
      }
    } finally {
      project.cleanup();
    }
  },
  {
    // Spawns the R/knitr engine; skip (not fail) where R is absent. Creates
    // the fixture tree as a side effect only when Rscript is present, so a
    // skipped run leaves nothing on disk (teardown never runs otherwise).
    prereq: async () => {
      if ((await which("Rscript")) === undefined) return false;
      e2eBase = Deno.makeTempDirSync({ prefix: "quarto_test_14683_" });
      e2eProjDir = join(e2eBase, "testsite");
      e2eLabsDir = join(e2eProjDir, "labs");
      Deno.mkdirSync(e2eLabsDir, { recursive: true });
      return true;
    },
    // Run from the doc's subdirectory so the bare filename is cwd-relative,
    // exactly as RStudio's Render button invokes preview. The harness restores
    // the original cwd afterward.
    cwd: () => e2eLabsDir,
    setup: () => {
      // Re-activate renv against the real tests/ project, regardless of
      // this fixture's cwd — see llm-docs/testing-patterns.md → "R Tests
      // That Change Working Directory" for why this is needed.
      const testsDir = dirname(dirname(fromFileUrl(import.meta.url)))
        .replaceAll("\\", "/");
      Deno.writeTextFileSync(
        join(e2eProjDir, ".Rprofile"),
        `Sys.setenv(RENV_PROJECT = "${testsDir}")\n` +
          `source("${testsDir}/renv/activate.R")\n`,
      );

      Deno.writeTextFileSync(
        join(e2eProjDir, "_quarto.yml"),
        'project:\n  type: website\n\nwebsite:\n  title: "testsite"\n',
      );
      Deno.writeTextFileSync(
        join(e2eProjDir, "index.qmd"),
        "---\ntitle: Index\n---\n\nHome.\n",
      );
      // Second chunk echoes QUARTO_DOCUMENT_PATH so the render also proves the
      // env var (derived from target.source) resolves to the doc's subdirectory
      // rather than "." / the project root — the #12401 inconsistency.
      Deno.writeTextFileSync(
        join(e2eLabsDir, "claudetest.qmd"),
        "---\ntitle: Claude Test\n---\n\n```{r}\n1 + 1\n```\n\n" +
          '```{r}\ncat("QDP:", Sys.getenv("QUARTO_DOCUMENT_PATH"))\n```\n',
      );
      return Promise.resolve();
    },
    teardown: () => {
      // Best-effort: the harness restores cwd after teardown, so on Windows the
      // dir may still be the cwd and resist removal — acceptable, matching the
      // house pattern (see tests/smoke/use/template.test.ts).
      try {
        Deno.removeSync(e2eBase, { recursive: true });
      } catch {
        // ignore
      }
      return Promise.resolve();
    },
  },
);

// Deterministic, R-free guard for the root cause. Seeding the cache with a
// relative path (as preview's format resolution does) and then looking up by
// the absolute path (as renderProject does) must return one cached target whose
// input/source are absolute — never the stale relative string. This is what the
// knitr R subprocesses (execute, dependencies, postprocess) read, so asserting
// the target is absolute covers every reader without needing R. A fix that only
// absolutized at execute time would leave the cached target relative and fail.
// Uses TestContext.cwd + a bare filename (not relative(Deno.cwd(), absFile)):
// path.relative() falls back to returning the absolute path unchanged when its
// two arguments are on different Windows drives, which would make the "seed
// with a relative path" step silently seed with an absolute one instead and
// pass even without the fix (see .github/workflows/test-smokes.yml's "Fix temp
// dir to use runner one" step, which exists because the default drive for
// %TEMP% and the checkout can differ on GitHub's Windows runners).
const guardBase = Deno.makeTempDirSync({ prefix: "quarto_test_14683b_" });
const guardProjDir = join(guardBase, "testsite");
const guardLabsDir = join(guardProjDir, "labs");
Deno.mkdirSync(guardLabsDir, { recursive: true });

unitTest(
  "fileExecutionEngineAndTarget yields an absolute target for a relative subdir input (#14683)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    // cwd is guardLabsDir (set by the harness via TestContext.cwd).
    const absFile = join(guardLabsDir, "claudetest.qmd");
    const relFile = "claudetest.qmd";

    const nbContext = notebookContext();
    const project = (await projectContext(guardLabsDir, nbContext)) ??
      (await singleFileProjectContext(absFile, nbContext));

    try {
      // Seed with the relative path. Building the target reads only
      // markdown/YAML (no R execution), so this is deterministic.
      const seeded = await project.fileExecutionEngineAndTarget(relFile);
      assert(
        isAbsolute(seeded.target.input) && isAbsolute(seeded.target.source),
        `Seeded target should be absolute; got input=${seeded.target.input} ` +
          `source=${seeded.target.source} (#14683)`,
      );

      // Look up by the absolute path (renderProject's spelling). The
      // normalized cache key collides with the seeded entry; the returned
      // target must still be absolute and be the same cached object.
      const resolved = await project.fileExecutionEngineAndTarget(absFile);
      assert(
        isAbsolute(resolved.target.input),
        `Expected absolute target.input after absolute lookup, got ` +
          `${resolved.target.input} (#14683)`,
      );
      assert(
        isAbsolute(resolved.target.source),
        `Expected absolute target.source after absolute lookup, got ` +
          `${resolved.target.source} (#14683)`,
      );
      assert(
        resolved.target === seeded.target,
        "Relative and absolute lookups must hit the same cached target (#14683)",
      );
    } finally {
      project.cleanup();
    }
  },
  {
    cwd: () => guardLabsDir,
    setup: () => {
      Deno.writeTextFileSync(
        join(guardProjDir, "_quarto.yml"),
        'project:\n  type: website\n\nwebsite:\n  title: "testsite"\n',
      );
      Deno.writeTextFileSync(
        join(guardLabsDir, "claudetest.qmd"),
        "---\ntitle: Claude Test\n---\n\n```{r}\n1 + 1\n```\n",
      );
      return Promise.resolve();
    },
    teardown: () => {
      try {
        Deno.removeSync(guardBase, { recursive: true });
      } catch {
        // ignore — best-effort (see the anti-pattern doc's Windows cwd note)
      }
      return Promise.resolve();
    },
  },
);
