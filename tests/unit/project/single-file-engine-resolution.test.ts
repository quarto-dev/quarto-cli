/*
 * single-file-engine-resolution.test.ts
 *
 * Tests that singleFileProjectContext resolves engine extensions
 * even without renderOptions (the preview code path).
 * Related to issue #13983
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { singleFileProjectContext } from "../../../src/project/types/single-file/single-file.ts";
import { notebookContext } from "../../../src/render/notebook/notebook-context.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";

unitTest(
  "singleFileProjectContext resolves engine extensions without renderOptions",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    const tmpDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
    const file = join(tmpDir, "test.qmd");
    Deno.writeTextFileSync(
      file,
      "---\ntitle: test\nengine: julia\n---\n",
    );

    try {
      const nbContext = notebookContext();
      const project = await singleFileProjectContext(file, nbContext);

      assert(
        project.config !== undefined,
        "config should be initialized even without renderOptions",
      );
      assert(
        Array.isArray(project.config?.engines) &&
          project.config.engines.length > 0,
        "engine extensions should be resolved (bundled engines discovered)",
      );
    } finally {
      Deno.removeSync(tmpDir, { recursive: true });
    }
  },
);
