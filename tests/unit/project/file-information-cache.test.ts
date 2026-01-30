/*
 * file-information-cache.test.ts
 *
 * Tests for fileInformationCache path normalization
 * Related to issue #13955
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureFileInformationCache } from "../../../src/project/project-shared.ts";
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
