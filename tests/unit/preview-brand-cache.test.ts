/*
 * preview-brand-cache.test.ts
 *
 * Tests that projectResolveBrand re-resolves _brand.yml when the file is
 * added or removed during the lifetime of a long-lived ProjectContext
 * (as happens in `quarto preview`, where the context persists across
 * re-renders). Regression test for quarto-cli-t7b1.
 *
 * The bug: project.brandCache is populated on first resolve and never
 * invalidated, so a _brand.yml created/removed mid-session is ignored
 * until the preview process restarts. RStudio's Render button runs
 * `quarto preview --no-watch-inputs` and routes re-renders through the
 * same persistent context, so it observes the stale brand.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { singleFileProjectContext } from "../../src/project/types/single-file/single-file.ts";
import { projectContext } from "../../src/project/project-context.ts";
import { notebookContext } from "../../src/render/notebook/notebook-context.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";
import { safeRemoveSync } from "../../src/core/path.ts";

const BRAND_YML = `color:
  palette:
    imperial-red: "#BC1E22"
  primary: imperial-red
`;

unitTest(
  "projectResolveBrand - single-file: _brand.yml added mid-session is detected (t7b1)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
    const file = join(tmpDir, "test.qmd");
    const brandFile = join(tmpDir, "_brand.yml");

    try {
      Deno.writeTextFileSync(file, "---\ntitle: test\nformat: typst\n---\n");

      const project = await singleFileProjectContext(file, notebookContext());

      // First resolve with no _brand.yml: brand is undefined and the
      // result is cached on the persistent project context.
      const before = await project.resolveBrand();
      assertEquals(before, undefined, "no _brand.yml yet, brand must be undefined");

      // User adds _brand.yml while the (preview) context is still alive.
      Deno.writeTextFileSync(brandFile, BRAND_YML);

      // A subsequent resolve must pick up the newly-added brand.
      const after = await project.resolveBrand();
      assert(
        after !== undefined,
        "brand must be resolved after _brand.yml is added (currently stale-cached as undefined)",
      );
    } finally {
      safeRemoveSync(tmpDir, { recursive: true });
    }
  },
);

unitTest(
  "projectResolveBrand - single-file: _brand.yml removed mid-session is detected (t7b1)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
    const file = join(tmpDir, "test.qmd");
    const brandFile = join(tmpDir, "_brand.yml");

    try {
      Deno.writeTextFileSync(file, "---\ntitle: test\nformat: typst\n---\n");
      Deno.writeTextFileSync(brandFile, BRAND_YML);

      const project = await singleFileProjectContext(file, notebookContext());

      const before = await project.resolveBrand();
      assert(before !== undefined, "_brand.yml present, brand must resolve");

      // User removes/deactivates _brand.yml mid-session (the `.bak` case).
      Deno.removeSync(brandFile);

      const after = await project.resolveBrand();
      assertEquals(
        after,
        undefined,
        "brand must revert to undefined after _brand.yml is removed (currently stale-cached as defined)",
      );
    } finally {
      safeRemoveSync(tmpDir, { recursive: true });
    }
  },
);

unitTest(
  "projectResolveBrand - project (_quarto.yml present): _brand.yml added mid-session is detected (t7b1)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
    const brandFile = join(tmpDir, "_brand.yml");
    let project;

    try {
      // A real multi-file project with a _quarto.yml, no brand declared.
      Deno.writeTextFileSync(
        join(tmpDir, "_quarto.yml"),
        "project:\n  type: default\n",
      );
      Deno.writeTextFileSync(
        join(tmpDir, "index.qmd"),
        "---\ntitle: test\nformat: typst\n---\n",
      );

      project = await projectContext(tmpDir, notebookContext());
      assert(project !== undefined, "projectContext must resolve for a _quarto.yml dir");

      const before = await project.resolveBrand();
      assertEquals(before, undefined, "no _brand.yml yet, brand must be undefined");

      Deno.writeTextFileSync(brandFile, BRAND_YML);

      const after = await project.resolveBrand();
      assert(
        after !== undefined,
        "brand must be resolved after _brand.yml is added to the project (currently stale-cached as undefined)",
      );
    } finally {
      // Release the project's disk cache before removing the dir, otherwise
      // Windows holds a lock on the temp directory.
      project?.cleanup?.();
      safeRemoveSync(tmpDir, { recursive: true });
    }
  },
);

unitTest(
  "projectResolveBrand - project (_quarto.yml present): _brand.yml removed mid-session is detected (t7b1)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
    const brandFile = join(tmpDir, "_brand.yml");
    let project;

    try {
      // A real multi-file project with a _quarto.yml and a _brand.yml present.
      Deno.writeTextFileSync(
        join(tmpDir, "_quarto.yml"),
        "project:\n  type: default\n",
      );
      Deno.writeTextFileSync(
        join(tmpDir, "index.qmd"),
        "---\ntitle: test\nformat: typst\n---\n",
      );
      Deno.writeTextFileSync(brandFile, BRAND_YML);

      project = await projectContext(tmpDir, notebookContext());
      assert(project !== undefined, "projectContext must resolve for a _quarto.yml dir");

      const before = await project.resolveBrand();
      assert(before !== undefined, "_brand.yml present, brand must resolve");

      Deno.removeSync(brandFile);

      const after = await project.resolveBrand();
      assertEquals(
        after,
        undefined,
        "brand must revert to undefined after _brand.yml is removed from the project (currently stale-cached as defined)",
      );
    } finally {
      // Release the project's disk cache before removing the dir, otherwise
      // Windows holds a lock on the temp directory.
      project?.cleanup?.();
      safeRemoveSync(tmpDir, { recursive: true });
    }
  },
);
