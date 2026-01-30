/*
 * utils.ts
 *
 * Test utilities for project-related unit tests
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ProjectContext } from "../../../src/project/types.ts";
import { FileInformationCacheMap } from "../../../src/project/project-shared.ts";

/**
 * Create a minimal mock ProjectContext for testing.
 * Only provides the essential properties needed for cache-related tests.
 *
 * @param dir - The project directory (defaults to a temp directory)
 * @returns A mock ProjectContext suitable for unit testing
 */
export function createMockProjectContext(
  dir?: string,
): ProjectContext {
  const projectDir = dir ?? Deno.makeTempDirSync({ prefix: "quarto-test" });
  const ownsDir = dir === undefined;

  return {
    dir: projectDir,
    engines: [],
    files: { input: [] },
    notebookContext: {} as ProjectContext["notebookContext"],
    fileInformationCache: new FileInformationCacheMap(),
    resolveBrand: () => Promise.resolve(undefined),
    resolveFullMarkdownForFile: () => Promise.resolve({} as never),
    fileExecutionEngineAndTarget: () => Promise.resolve({} as never),
    fileMetadata: () => Promise.resolve({}),
    environment: () => Promise.resolve({} as never),
    renderFormats: () => Promise.resolve({}),
    clone: function () {
      return this;
    },
    isSingleFile: false,
    diskCache: {} as ProjectContext["diskCache"],
    temp: {} as ProjectContext["temp"],
    cleanup: () => {
      if (ownsDir) {
        try {
          Deno.removeSync(projectDir, { recursive: true });
        } catch {
          // Ignore cleanup errors in tests
        }
      }
    },
  } as ProjectContext;
}
