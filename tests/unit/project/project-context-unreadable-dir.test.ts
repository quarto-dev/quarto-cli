/*
 * project-context-unreadable-dir.test.ts
 *
 * projectContext() rejects with PermissionDenied when the input walk hits an
 * unreadable directory, releases the context it built before throwing, and
 * tags the error so render/preview can frame it.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
} from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { normalizePath } from "../../../src/core/path.ts";
import { ErrorEx } from "../../../src/core/lib/error.ts";
import {
  frameInputWalkError,
  projectContext,
} from "../../../src/project/project-context.ts";
import { notebookContext } from "../../../src/render/notebook/notebook-context.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import {
  canMakeUnreadableDir,
  makeUnreadableDir,
  withTempDir,
} from "../../utils.ts";

function sessionTempDirs(root: string) {
  const dotQuarto = join(root, ".quarto");
  if (!existsSync(dotQuarto)) {
    return [];
  }
  return Array.from(Deno.readDirSync(dotQuarto))
    .map((entry) => entry.name)
    .filter((name) => name.startsWith("quarto-session-temp"));
}

// Not registered when the dir can't be made unreadable (root on Unix).
if (canMakeUnreadableDir) {
  for (
    const [label, quartoYml, force] of [
      ["project key", "project:\n  type: default\n", false],
      ["no project key", "format: html\n", false],
      ["no _quarto.yml, forced", undefined, true],
    ] as const
  ) {
    unitTest(
      `projectContext releases its context when the input walk is denied (${label})`,
      async () => {
        await initYamlIntelligenceResourcesFromFilesystem();
        // withTempDir removes the project afterwards: on Windows that fails
        // with os error 32 while the project disk cache is still open.
        await withTempDir(async (tmp) => {
          const root = normalizePath(tmp);
          if (quartoYml) {
            Deno.writeTextFileSync(join(root, "_quarto.yml"), quartoYml);
          }
          Deno.writeTextFileSync(join(root, "index.qmd"), "# Hello\n");
          const locked = join(root, "locked");
          Deno.mkdirSync(locked);
          Deno.writeTextFileSync(join(locked, "doc.qmd"), "# Locked\n");
          const restore = makeUnreadableDir(locked);
          let walkError: unknown;
          try {
            walkError = await assertRejects(
              () => projectContext(root, notebookContext(), undefined, force),
              Deno.errors.PermissionDenied,
            );
          } finally {
            restore();
          }
          assertEquals(sessionTempDirs(root), []);

          const framed = frameInputWalkError(walkError);
          if (force) {
            // no project root to report: the raw error is kept
            assertStrictEquals(framed, walkError);
          } else {
            assertInstanceOf(framed, ErrorEx);
            assertEquals(framed.printStack, false);
            assertEquals(framed.printName, false);
            assertStringIncludes(framed.message, `readdir '${locked}'`);
          }
        }, "quarto-unreadable-walk");
      },
    );
  }
}
