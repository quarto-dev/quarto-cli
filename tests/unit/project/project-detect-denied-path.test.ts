/*
 * project-detect-denied-path.test.ts
 *
 * Extension project detectors count a detect path only when it can be
 * stat'ed: a `config/` that can't be searched does not make its parent a Hugo
 * project, while real Hugo sites are still detected.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { normalizePath } from "../../../src/core/path.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { projectContext } from "../../../src/project/project-context.ts";
import { notebookContext } from "../../../src/render/notebook/notebook-context.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import {
  canMakeUnreadableDir,
  makeUnreadableDir,
  withTempDir,
} from "../../utils.ts";

// `<root>/config/` and `<root>/content/`, plus `<root>/work/doc.qmd` with no
// _quarto.yml anywhere, so only the Hugo detectors can claim `<root>`.
function hugoLikeTree(tmp: string, configToml: boolean) {
  const root = normalizePath(tmp);
  Deno.mkdirSync(join(root, "config", "_default"), { recursive: true });
  if (configToml) {
    Deno.writeTextFileSync(
      join(root, "config", "_default", "config.toml"),
      "",
    );
  }
  Deno.mkdirSync(join(root, "content"));
  Deno.mkdirSync(join(root, "work"));
  Deno.writeTextFileSync(join(root, "work", "doc.qmd"), "# Hello\n");
  return root;
}

// The bundled Hugo extension declares `type: default`, so the detected root,
// not the project type, shows whether it matched.
async function projectRoot(dir: string) {
  const context = await projectContext(dir, notebookContext());
  try {
    return context?.dir;
  } finally {
    context?.cleanup();
  }
}

// Not registered when the dir can't be made unreadable (root on Unix).
if (canMakeUnreadableDir) {
  unitTest(
    "detection ignores Hugo markers below a config/ that can't be read",
    async () => {
      await initYamlIntelligenceResourcesFromFilesystem();
      await withTempDir(async (tmp) => {
        const root = hugoLikeTree(tmp, false);
        const restore = makeUnreadableDir(join(root, "config"));
        try {
          assertEquals(
            await projectRoot(join(root, "work")),
            undefined,
          );
        } finally {
          restore();
        }
      }, "quarto-detect-denied");
    },
  );
}

// Mode 644 lets config/ be listed but not searched, which Windows can't
// express with icacls deny on listing.
if (!isWindows && Deno.uid() !== 0) {
  unitTest(
    "detection ignores Hugo markers below a config/ that can't be searched",
    async () => {
      await initYamlIntelligenceResourcesFromFilesystem();
      await withTempDir(async (tmp) => {
        const root = hugoLikeTree(tmp, false);
        const config = join(root, "config");
        Deno.chmodSync(config, 0o644);
        try {
          assertEquals(
            await projectRoot(join(root, "work")),
            undefined,
          );
        } finally {
          Deno.chmodSync(config, 0o755);
        }
      }, "quarto-detect-denied");
    },
  );

  unitTest(
    "detection keeps a Hugo site whose config file can't be read",
    async () => {
      await initYamlIntelligenceResourcesFromFilesystem();
      await withTempDir(async (tmp) => {
        const root = hugoLikeTree(tmp, true);
        const configToml = join(root, "config", "_default", "config.toml");
        Deno.chmodSync(configToml, 0o000);
        try {
          assertEquals(await projectRoot(join(root, "work")), root);
        } finally {
          Deno.chmodSync(configToml, 0o644);
        }
      }, "quarto-detect-denied");
    },
  );
}

unitTest("detection keeps a readable Hugo site", async () => {
  await initYamlIntelligenceResourcesFromFilesystem();
  await withTempDir(async (tmp) => {
    const root = hugoLikeTree(tmp, true);
    assertEquals(await projectRoot(join(root, "work")), root);
  }, "quarto-detect-denied");
});
