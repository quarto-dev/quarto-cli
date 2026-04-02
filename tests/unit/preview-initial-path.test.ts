/*
 * preview-initial-path.test.ts
 *
 * Tests that previewInitialPath computes the correct browse URL path
 * for different project types. Regression test for #14298.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { normalizePath } from "../../src/core/path.ts";
import { previewInitialPath } from "../../src/command/preview/preview.ts";
import { ProjectContext } from "../../src/project/types.ts";

function mockProjectContext(
  dir: string,
  isSingleFile: boolean,
): ProjectContext {
  return {
    dir: normalizePath(dir),
    isSingleFile,
    engines: [],
    files: { input: [], resources: [], config: [], configResources: [] },
    config: { project: {} },
    notebookContext: () => ({ resolve: () => undefined, get: () => undefined }),
    resolveFullMarkdownForFile: () => Promise.resolve(undefined),
    cleanup: () => {},
  } as unknown as ProjectContext;
}

// deno-lint-ignore require-await
unitTest("previewInitialPath - single file returns empty path (#14298)", async () => {
  const dir = normalizePath(Deno.makeTempDirSync({ prefix: "quarto-test" }));
  const outputFile = join(dir, "hello.html");
  const project = mockProjectContext(dir, true);

  const result = previewInitialPath(outputFile, project);
  assertEquals(result, "", "Single-file preview should use root path, not filename");

  Deno.removeSync(dir, { recursive: true });
});

// deno-lint-ignore require-await
unitTest("previewInitialPath - project file returns relative path", async () => {
  const dir = normalizePath(Deno.makeTempDirSync({ prefix: "quarto-test" }));
  const outputFile = join(dir, "chapter.html");
  const project = mockProjectContext(dir, false);

  const result = previewInitialPath(outputFile, project);
  assertEquals(result, "chapter.html", "Project preview should include relative path");

  Deno.removeSync(dir, { recursive: true });
});

// deno-lint-ignore require-await
unitTest("previewInitialPath - project subdir returns relative path", async () => {
  const dir = normalizePath(Deno.makeTempDirSync({ prefix: "quarto-test" }));
  const outputFile = join(dir, "pages", "about.html");
  const project = mockProjectContext(dir, false);

  const result = previewInitialPath(outputFile, project);
  assertEquals(result, "pages/about.html", "Project preview should include subdirectory path");

  Deno.removeSync(dir, { recursive: true });
});

// deno-lint-ignore require-await
unitTest("previewInitialPath - undefined project returns empty path", async () => {
  const result = previewInitialPath("/tmp/hello.html", undefined);
  assertEquals(result, "", "No project should use root path");
});
