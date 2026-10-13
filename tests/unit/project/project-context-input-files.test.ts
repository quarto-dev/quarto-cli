/*
 * project-context-input-files.test.ts
 *
 * Characterizes projectContext() root resolution and input-file discovery
 * for a small project: which files are inputs, which are ignored, and when a
 * file path falls back to single-file mode.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { dirname, join, relative } from "../../../src/deno_ral/path.ts";
import { normalizePath } from "../../../src/core/path.ts";
import { projectContext } from "../../../src/project/project-context.ts";
import { ProjectContext } from "../../../src/project/types.ts";
import { notebookContext } from "../../../src/render/notebook/notebook-context.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import { docs, withTempDir } from "../../utils.ts";

const kDoc = "---\ntitle: test\n---\n\nHello\n";

const kInputs = ["index.qmd", "notes.md", "sub/page.qmd"];
const kIgnored = [
  "_partial.qmd",
  "_dir/c.qmd",
  ".hidden/d.qmd",
  "node_modules/e.qmd",
  "README.md",
];

function writeProject(dir: string, quartoYml: string) {
  Deno.writeTextFileSync(join(dir, "_quarto.yml"), quartoYml);
  for (const file of [...kInputs, ...kIgnored]) {
    const path = join(dir, file);
    Deno.mkdirSync(dirname(path), { recursive: true });
    Deno.writeTextFileSync(path, kDoc);
  }
  Deno.writeTextFileSync(join(dir, "notes.txt"), "not an input");
}

function relativeInputs(context: ProjectContext) {
  return context.files.input
    .map((file) => relative(context.dir, file).replaceAll("\\", "/"))
    .sort();
}

async function withContext(
  path: string,
  fn: (context: ProjectContext | undefined) => void | Promise<void>,
) {
  await initYamlIntelligenceResourcesFromFilesystem();
  const context = await projectContext(path, notebookContext());
  try {
    await fn(context);
  } finally {
    context?.cleanup();
  }
}

for (
  const [label, quartoYml] of [
    ["project key", "project:\n  type: default\n"],
    ["no project key", "format: html\n"],
  ]
) {
  unitTest(
    `projectContext from a subdir resolves root and input files (${label})`,
    async () => {
      await withTempDir(async (tmp) => {
        const root = normalizePath(tmp);
        writeProject(root, quartoYml);
        await withContext(join(root, "sub"), (context) => {
          assert(context, "expected a project context");
          assertEquals(context.dir, root);
          assertEquals(relativeInputs(context), kInputs);
          assertEquals(context.files.config, [join(root, "_quarto.yml")]);
          assertEquals(context.engines, ["markdown"]);
        });
      });
    },
  );

  unitTest(
    `projectContext for a file in the inputs returns the project (${label})`,
    async () => {
      await withTempDir(async (tmp) => {
        const root = normalizePath(tmp);
        writeProject(root, quartoYml);
        await withContext(join(root, "sub", "page.qmd"), (context) => {
          assert(context, "expected a project context");
          assertEquals(context.dir, root);
        });
      });
    },
  );
}

// Tracked fixture rather than a temp dir: this path leaves the project's
// disk cache open, so the directory cannot be removed on Windows.
unitTest(
  "projectContext for a file outside the inputs returns undefined",
  async () => {
    await withContext(
      docs("project/outside-inputs/_partial.qmd"),
      (context) => {
        assertEquals(context, undefined);
      },
    );
  },
);

unitTest(
  "projectContext without _quarto.yml returns undefined",
  async () => {
    await withTempDir(async (tmp) => {
      const root = normalizePath(tmp);
      Deno.writeTextFileSync(join(root, "index.qmd"), kDoc);
      await withContext(root, (context) => {
        assertEquals(context, undefined);
      });
    });
  },
);
