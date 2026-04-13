/*
 * utils.ts
 *
 * Test utilities for project-related unit tests
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { ProjectContext } from "../../../src/project/types.ts";
import { FileInformationCacheMap } from "../../../src/project/project-shared.ts";

/**
 * Create a minimal mock ProjectContext for testing.
 *
 * @param options.dir - The project directory (defaults to a temp directory)
 * @param options.isSingleFile - Whether this is a single-file project (defaults to false)
 * @param options.config - Project config (defaults to { project: {} })
 * @returns A mock ProjectContext suitable for unit testing
 */
export function createMockProjectContext(
  options?: {
    dir?: string;
    isSingleFile?: boolean;
    config?: ProjectContext["config"];
  },
): ProjectContext {
  const projectDir = options?.dir ??
    Deno.makeTempDirSync({ prefix: "quarto-test" });
  const ownsDir = options?.dir === undefined;

  return {
    dir: projectDir,
    engines: [],
    files: { input: [] },
    config: options?.config ?? { project: {} },
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
    isSingleFile: options?.isSingleFile ?? false,
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
