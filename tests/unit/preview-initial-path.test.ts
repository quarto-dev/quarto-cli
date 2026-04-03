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
import { previewInitialPath } from "../../src/command/preview/preview.ts";
import { createMockProjectContext } from "./project/utils.ts";

// deno-lint-ignore require-await
unitTest("previewInitialPath - single file returns empty path (#14298)", async () => {
  const project = createMockProjectContext({ isSingleFile: true });
  const outputFile = join(project.dir, "hello.html");

  const result = previewInitialPath(outputFile, project);
  assertEquals(result, "", "Single-file preview should use root path, not filename");

  project.cleanup();
});

// deno-lint-ignore require-await
unitTest("previewInitialPath - project file returns relative path", async () => {
  const project = createMockProjectContext();
  const outputFile = join(project.dir, "chapter.html");

  const result = previewInitialPath(outputFile, project);
  assertEquals(result, "chapter.html", "Project preview should include relative path");

  project.cleanup();
});

// deno-lint-ignore require-await
unitTest("previewInitialPath - project subdir returns relative path", async () => {
  const project = createMockProjectContext();
  const outputFile = join(project.dir, "pages", "about.html");

  const result = previewInitialPath(outputFile, project);
  assertEquals(result, "pages/about.html", "Project preview should include subdirectory path");

  project.cleanup();
});

// deno-lint-ignore require-await
unitTest("previewInitialPath - undefined project returns empty path", async () => {
  const result = previewInitialPath("/tmp/hello.html", undefined);
  assertEquals(result, "", "No project should use root path");
});
