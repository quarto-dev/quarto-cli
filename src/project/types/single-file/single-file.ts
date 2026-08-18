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
import { warning } from "../../../deno_ral/log.ts";
import { warnOnce } from "../../../core/log.ts";
import { normalizePath } from "../../../core/path.ts";
import { NotebookContext } from "../../../render/notebook/notebook-types.ts";
import { makeProjectEnvironmentMemoizer } from "../../project-environment.ts";
import { ProjectContext } from "../../types.ts";
import { renderFormats } from "../../../command/render/render-contexts.ts";
import { RenderFlags, RenderOptions } from "../../../command/render/types.ts";
import { MappedString } from "../../../core/mapped-text.ts";
import { fileExecutionEngineAndTarget } from "../../../execute/engine.ts";
import {
  cleanupFileInformationCache,
  FileInformationCacheMap,
  projectFileMetadata,
  projectResolveBrand,
  projectResolveFullMarkdownForFile,
} from "../../project-shared.ts";
import { ExecutionEngineInstance } from "../../../execute/types.ts";
import { createProjectCache } from "../../../core/cache/cache.ts";
import { globalTempContext } from "../../../core/temp.ts";
import { once } from "../../../core/once.ts";
import {
  mergeExtensionMetadataForContext,
  resolveEngineExtensions,
} from "../../project-context.ts";
import { createExtensionContext } from "../../../extension/extension.ts";

export async function singleFileProjectContext(
  source: string,
  notebookContext: NotebookContext,
  renderOptions?: RenderOptions,
): Promise<ProjectContext> {
  const environmentMemoizer = makeProjectEnvironmentMemoizer(notebookContext);
  const temp = globalTempContext();
  const projectCacheBaseDir = temp.createDir();

  const normalizedDir = normalizePath(dirname(source));

  const result: ProjectContext = {
    clone: () => result,
    resolveBrand: (fileName?: string) => projectResolveBrand(result, fileName),
    dir: normalizedDir,
    engines: [],
    files: {
      input: [],
    },
    notebookContext,
    environment: () => environmentMemoizer(result),
    renderFormats,
    fileInformationCache: new FileInformationCacheMap(),
    fileExecutionEngineAndTarget: (
      file: string,
    ) => {
      return fileExecutionEngineAndTarget(
        file,
        renderOptions?.flags,
        result,
      );
    },
    resolveFullMarkdownForFile: (
      engine: ExecutionEngineInstance | undefined,
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
      cleanupFileInformationCache(result);
      result.diskCache.close();
    },
  };
  // Always resolve engine extensions so bundled engines (e.g. Julia) are
  // discovered even when called without renderOptions (e.g. from preview)
  const extensionContext = renderOptions?.services.extension ||
    createExtensionContext();
  result.config = result.config || { project: {} };
  result.config = await resolveEngineExtensions(
    extensionContext,
    result.config,
    result.dir,
  );

  // because the single-file project is cleaned up with
  // the global text context, we don't need to register it
  // in the same way that we need to register the multi-file
  // projects.
  // This is registered before the merge below, because the merge validates
  // extension metadata and can throw once the disk cache is already open.
  temp.onCleanup(result.cleanup);

  // Always merge extension metadata so contributions such as `brand` are
  // seen even when called without renderOptions (e.g. from preview, #14783)
  await mergeExtensionMetadataForContext(
    result,
    extensionContext,
    renderOptions !== undefined,
  );

  // Warn whenever an extension contributed output-dir metadata, whichever
  // command built this context, and on the render path also set forceClean
  // as if --output-dir was given on the command line, to ensure proper cleanup
  const outputDir = result.config?.project?.["output-dir"];
  if (outputDir) {
    const willForceClean = renderOptions
      ? renderOptions.flags?.clean !== false
      : undefined;
    const outcome = willForceClean === undefined
      ? "Output will go to that directory when the file is rendered."
      : `Output will go to that directory. The temporary .quarto directory will ${
        willForceClean
          ? "be cleaned up"
          : "NOT be cleaned up (--no-clean specified)"
      } after rendering.`;
    const message =
      `An extension contributed 'output-dir: ${outputDir}' metadata for a single file.\n` +
      `${outcome}\n` +
      "To suppress this warning, use --output-dir flag instead of extension metadata.";
    if (renderOptions && willForceClean !== undefined) {
      warning(message);
      renderOptions.forceClean = willForceClean;
    } else {
      // inspect, publish and serve build a context repeatedly, and the user
      // cannot act on this at that point, so say it once per process
      warnOnce(message);
    }
  }
  return result;
}
