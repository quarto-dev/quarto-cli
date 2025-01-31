/*
 * single-file.ts
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

// In the future, we will have a single-file project type
// that obeys exactly the same interface as a multi-file project.
//
// Currently, this file houses utilities to make the
// single-file path look closer to a project.

import { dirname } from "../../../deno_ral/path.ts";
import { normalizePath } from "../../../core/path.ts";
import { NotebookContext } from "../../../render/notebook/notebook-types.ts";
import { makeProjectEnvironmentMemoizer } from "../../project-environment.ts";
import { ProjectContext } from "../../types.ts";
import { renderFormats } from "../../../command/render/render-contexts.ts";
import { RenderFlags } from "../../../command/render/types.ts";
import { MappedString } from "../../../core/mapped-text.ts";
import { fileExecutionEngineAndTarget } from "../../../execute/engine.ts";
import {
  projectFileMetadata,
  projectResolveBrand,
  projectResolveFullMarkdownForFile,
} from "../../project-shared.ts";
import { ExecutionEngine } from "../../../execute/types.ts";
import { createProjectCache } from "../../../core/cache/cache.ts";
import { globalTempContext } from "../../../core/temp.ts";

export async function singleFileProjectContext(
  source: string,
  notebookContext: NotebookContext,
  flags?: RenderFlags,
): Promise<ProjectContext> {
  const environmentMemoizer = makeProjectEnvironmentMemoizer(notebookContext);
  const temp = globalTempContext();
  const projectCacheBaseDir = temp.createDir();

  const result: ProjectContext = {
    resolveBrand: (fileName?: string) => projectResolveBrand(result, fileName),
    dir: normalizePath(dirname(source)),
    engines: [],
    files: {
      input: [],
    },
    notebookContext,
    environment: () => environmentMemoizer(result),
    renderFormats,
    fileInformationCache: new Map(),
    fileExecutionEngineAndTarget: (
      file: string,
    ) => {
      return fileExecutionEngineAndTarget(
        file,
        flags,
        result,
      );
    },
    resolveFullMarkdownForFile: (
      engine: ExecutionEngine | undefined,
      file: string,
      markdown?: MappedString,
      force?: boolean,
    ) => {
      return projectResolveFullMarkdownForFile(
        result,
        engine,
        file,
        markdown,
        force,
      );
    },
    fileMetadata: async (file: string, force?: boolean) => {
      return projectFileMetadata(result, file, force);
    },
    isSingleFile: true,
    diskCache: await createProjectCache(projectCacheBaseDir),
    temp,
    cleanup: () => {
      result.diskCache.close();
    },
  };
  temp.onCleanup(result.cleanup);
  return result;
}
