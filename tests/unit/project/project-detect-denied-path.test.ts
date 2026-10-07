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
import { withTempDir } from "../../utils.ts";

// `config/` and `content/` at the root and `work/doc.qmd` below it, with no
// _quarto.yml, so only the Hugo detectors can claim the root.
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

// Mode bits only: on Windows, denying a directory listing doesn't stop a stat
// of a path below it, and root bypasses mode bits.
const ignore = isWindows || Deno.uid() === 0;

for (
  const [label, configToml, locked, mode, detected] of [
    ["ignores a config/ that can't be read", false, "config", 0o000, false],
    ["ignores a config/ that can't be searched", false, "config", 0o644, false],
    [
      "keeps a site whose config file can't be read",
      true,
      "config/_default/config.toml",
      0o000,
      true,
    ],
  ] as const
) {
  unitTest(`project detection - ${label}`, async () => {
    await initYamlIntelligenceResourcesFromFilesystem();
    await withTempDir(async (tmp) => {
      const root = hugoLikeTree(tmp, configToml);
      const path = join(root, locked);
      const original = Deno.statSync(path).mode! & 0o7777;
      Deno.chmodSync(path, mode);
      try {
        assertEquals(
          await projectRoot(join(root, "work")),
          detected ? root : undefined,
        );
      } finally {
        Deno.chmodSync(path, original);
      }
    }, "quarto-detect-denied");
  }, { ignore });
}

unitTest("project detection - keeps a readable Hugo site", async () => {
  await initYamlIntelligenceResourcesFromFilesystem();
  await withTempDir(async (tmp) => {
    const root = hugoLikeTree(tmp, true);
    assertEquals(await projectRoot(join(root, "work")), root);
  }, "quarto-detect-denied");
});
