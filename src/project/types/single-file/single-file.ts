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

import { dirname } from "path/dirname.ts";
import { normalizePath } from "../../../core/path.ts";
import { NotebookContext } from "../../../render/notebook/notebook-types.ts";
import { makeProjectEnvironmentMemoizer } from "../../project-environment.ts";
import { ProjectContext } from "../../types.ts";
import { renderFormats } from "../../../command/render/render-contexts.ts";
import { RenderFlags } from "../../../command/render/types.ts";
import { MappedString } from "../../../core/mapped-text.ts";
import { fileExecutionEngineAndTarget } from "../../../execute/engine.ts";
import { projectResolveFullMarkdownForFile } from "../../project-shared.ts";
import { ExecutionEngine } from "../../../execute/types.ts";

export function singleFileProjectContext(
  source: string,
  notebookContext: NotebookContext,
  flags?: RenderFlags,
): ProjectContext {
  const environmentMemoizer = makeProjectEnvironmentMemoizer(notebookContext);

  const result: ProjectContext = {
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
    isSingleFile: true,
  };
  return result;
}
