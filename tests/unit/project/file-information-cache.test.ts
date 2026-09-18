/*
 * file-information-cache.test.ts
 *
 * Tests for fileInformationCache path normalization
 * Related to issue #13955
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join, relative } from "../../../src/deno_ral/path.ts";
import {
  ensureFileInformationCache,
  FileInformationCacheMap,
  projectResolveFullMarkdownForFile,
} from "../../../src/project/project-shared.ts";
import { createMockProjectContext } from "./utils.ts";

// deno-lint-ignore require-await
unitTest(
  "fileInformationCache - same path returns same entry",
  async () => {
    const project = createMockProjectContext();

    // Use cross-platform absolute path (backslashes on Windows, forward on Linux)
    const path1 = join(project.dir, "doc.qmd");
    const path2 = join(project.dir, "doc.qmd");

    const entry1 = ensureFileInformationCache(project, path1);
    const entry2 = ensureFileInformationCache(project, path2);

    assert(
      entry1 === entry2,
      "Same path should return same cache entry",
    );
    assert(
      project.fileInformationCache.size === 1,
      "Should have exactly one cache entry",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "fileInformationCache - different paths create different entries",
  async () => {
    const project = createMockProjectContext();

    const path1 = join(project.dir, "doc1.qmd");
    const path2 = join(project.dir, "doc2.qmd");

    const entry1 = ensureFileInformationCache(project, path1);
    const entry2 = ensureFileInformationCache(project, path2);

    assert(
      entry1 !== entry2,
      "Different paths should return different cache entries",
    );
    assert(
      project.fileInformationCache.size === 2,
      "Should have two cache entries for different paths",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "fileInformationCache - cache entry persists across calls",
  async () => {
    const project = createMockProjectContext();

    const path = join(project.dir, "doc.qmd");

    // First call creates entry
    const entry1 = ensureFileInformationCache(project, path);
    // Modify the entry
    entry1.metadata = { title: "Test" };

    // Second call should return same entry with our modification
    const entry2 = ensureFileInformationCache(project, path);

    assert(
      entry2.metadata?.title === "Test",
      "Cache entry should persist modifications",
    );
    assert(
      entry1 === entry2,
      "Should return same cache entry object",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "ensureFileInformationCache - creates FileInformationCacheMap when cache is missing",
  async () => {
    const project = createMockProjectContext();
    // Simulate minimal ProjectContext without cache (as in command-utils.ts)
    // deno-lint-ignore no-explicit-any
    (project as any).fileInformationCache = undefined;

    ensureFileInformationCache(project, join(project.dir, "doc.qmd"));

    assert(
      project.fileInformationCache instanceof FileInformationCacheMap,
      "Should create FileInformationCacheMap, not plain Map",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "fileInformationCache - relative and absolute paths share same entry",
  async () => {
    const project = createMockProjectContext();

    const absolutePath = join(project.dir, "subdir", "page.qmd");
    const relativePath = relative(Deno.cwd(), absolutePath);

    const entry1 = ensureFileInformationCache(project, relativePath);
    const entry2 = ensureFileInformationCache(project, absolutePath);

    assert(
      entry1 === entry2,
      "Relative and absolute paths to same file should share a cache entry",
    );
    assert(
      project.fileInformationCache.size === 1,
      "Should have exactly one cache entry",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "fileInformationCache - invalidateForFile deletes transient notebook file",
  async () => {
    const project = createMockProjectContext();
    const sourcePath = join(project.dir, "doc.qmd");

    // Create a real temp file simulating a transient .quarto_ipynb
    const notebookPath = join(project.dir, "doc.quarto_ipynb");
    Deno.writeTextFileSync(notebookPath, '{"cells": []}');
    assert(existsSync(notebookPath), "Temp notebook file should exist");

    // Populate cache entry with a transient target pointing to the file
    const entry = ensureFileInformationCache(project, sourcePath);
    entry.target = {
      source: sourcePath,
      input: notebookPath,
      markdown: asMappedString(""),
      metadata: {},
      data: { transient: true, kernelspec: {} },
    };

    // Invalidate the cache entry for this file
    project.fileInformationCache.invalidateForFile(sourcePath);

    // The transient file should be deleted from disk
    assert(
      !existsSync(notebookPath),
      "Transient notebook file should be deleted on invalidation",
    );
    // The cache entry should be removed
    assert(
      !project.fileInformationCache.has(sourcePath),
      "Cache entry should be removed after invalidation",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "fileInformationCache - invalidateForFile preserves non-transient files",
  async () => {
    const project = createMockProjectContext();
    const sourcePath = join(project.dir, "notebook.ipynb");

    // Create a real file simulating a user's .ipynb (non-transient)
    const notebookPath = join(project.dir, "notebook.ipynb");
    Deno.writeTextFileSync(notebookPath, '{"cells": []}');

    // Populate cache entry with a non-transient target
    const entry = ensureFileInformationCache(project, sourcePath);
    entry.target = {
      source: sourcePath,
      input: notebookPath,
      markdown: asMappedString(""),
      metadata: {},
      data: { transient: false, kernelspec: {} },
    };

    // Invalidate the cache entry
    project.fileInformationCache.invalidateForFile(sourcePath);

    // The non-transient file should NOT be deleted
    assert(
      existsSync(notebookPath),
      "Non-transient file should be preserved on invalidation",
    );
    // But the cache entry should still be removed
    assert(
      !project.fileInformationCache.has(sourcePath),
      "Cache entry should be removed after invalidation",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "fileInformationCache - invalidateForFile handles entry with no target",
  async () => {
    const project = createMockProjectContext();
    const sourcePath = join(project.dir, "doc.qmd");

    // Populate cache entry with metadata only (no target)
    const entry = ensureFileInformationCache(project, sourcePath);
    entry.metadata = { title: "Test" };

    // Should not throw
    project.fileInformationCache.invalidateForFile(sourcePath);

    assert(
      !project.fileInformationCache.has(sourcePath),
      "Cache entry should be removed even without a target",
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "fileInformationCache - invalidateForFile is a no-op for missing keys",
  async () => {
    const project = createMockProjectContext();

    // Should not throw on a key that doesn't exist
    project.fileInformationCache.invalidateForFile(
      join(project.dir, "nonexistent.qmd"),
    );

    assert(
      project.fileInformationCache.size === 0,
      "Cache should remain empty",
    );
  },
);

unitTest(
  "projectResolveFullMarkdownForFile - re-reads when source file mtime changes",
  async () => {
    const project = createMockProjectContext();
    const file = join(project.dir, "doc.qmd");

    // First read populates the cache.
    Deno.writeTextFileSync(file, "# v1\n");
    const result1 = await projectResolveFullMarkdownForFile(
      project,
      undefined,
      file,
    );
    assert(
      result1.value.includes("v1"),
      `Expected v1 in first read, got: ${result1.value}`,
    );

    // Modify content and force mtime strictly forward via utimeSync.
    // writeTextFileSync alone may collide with the prior write's mtime
    // on coarse-resolution filesystems (FAT32 ~2 s, some network
    // mounts), so utimeSync is mandatory here — removing it would let
    // this test pass vacuously on a fast filesystem and silently
    // regress the guard.
    Deno.writeTextFileSync(file, "# v2\n");
    const future = new Date(Date.now() + 2000);
    Deno.utimeSync(file, future, future);

    // Second read must re-fetch from disk via the mtime guard, otherwise
    // the project preview path serves stale rendered output (#10392).
    const result2 = await projectResolveFullMarkdownForFile(
      project,
      undefined,
      file,
    );
    assert(
      result2.value.includes("v2"),
      `Expected v2 after mtime change, got: ${result2.value}`,
    );

    project.cleanup();
  },
);

unitTest(
  "projectResolveFullMarkdownForFile - re-reads when size changes but mtime is preserved",
  async () => {
    const project = createMockProjectContext();
    const file = join(project.dir, "doc.qmd");

    // First read populates the cache with mtime + size of v1.
    Deno.writeTextFileSync(file, "# v1\n");
    const mtimeV1 = Deno.statSync(file).mtime!;
    const result1 = await projectResolveFullMarkdownForFile(
      project,
      undefined,
      file,
    );
    assert(
      result1.value.includes("v1"),
      `Expected v1 in first read, got: ${result1.value}`,
    );

    // Overwrite content with a different size, then restore the original
    // mtime. This simulates the edge case where an edit lands within a
    // single mtime tick on a coarse-resolution filesystem: mtime is
    // unchanged but content (and therefore size) differs.
    Deno.writeTextFileSync(file, "# v2 with extra bytes to change size\n");
    Deno.utimeSync(file, mtimeV1, mtimeV1);

    // Second read must re-fetch via the size guard, since the mtime
    // alone would not detect the change.
    const result2 = await projectResolveFullMarkdownForFile(
      project,
      undefined,
      file,
    );
    assert(
      result2.value.includes("v2"),
      `Expected v2 after size change, got: ${result2.value}`,
    );

    project.cleanup();
  },
);
