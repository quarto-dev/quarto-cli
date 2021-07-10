/*
* render-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { pathWithForwardSlashes } from "../../core/path.ts";
import {
  projectContext,
  projectContextForDirectory,
} from "../../project/project-context.ts";

import { renderProject } from "./project.ts";
import { renderFiles } from "./render.ts";
import { resolveFileResources } from "./resources.ts";
import { RenderedFile, RenderOptions, RenderResult } from "./types.ts";
import { PartitionedMarkdown } from "../../core/pandoc/types.ts";
import { fileExecutionEngine } from "../../execute/engine.ts";

export async function render(
  path: string,
  options: RenderOptions,
): Promise<RenderResult> {
  // determine target context/files
  const context = await projectContext(path);

  if (Deno.statSync(path).isDirectory) {
    // if the path is a sub-directory of the project, then create
    // a files list that is only those files in the subdirectory
    let files: string[] | undefined;
    if (context) {
      const renderDir = Deno.realPathSync(path);
      const projectDir = Deno.realPathSync(context.dir);
      if (renderDir !== projectDir) {
        files = context.files.input.filter((file) =>
          file.startsWith(renderDir)
        );
      }
    }

    // all directories are considered projects
    return renderProject(
      context || await projectContextForDirectory(path),
      options,
      files,
    );
  } else if (context?.config) {
    // if there is a project file then treat this as a project render
    // if the passed file is in the render list
    const renderPath = Deno.realPathSync(path);
    if (
      context.files.input.map((file) => Deno.realPathSync(file)).includes(
        renderPath,
      )
    ) {
      return renderProject(context, options, [path]);
    }
  }

  // otherwise it's just a file render
  const result = await renderFiles([path], options);

  // get partitioned markdown if we had result files
  const engine = fileExecutionEngine(path);
  const partitioned = (engine && result.files.length > 0)
    ? await engine.partitionedMarkdown(path)
    : undefined;

  // return files
  return {
    files: result.files.map((file) => {
      const resourceFiles = resourceFilesFromRenderedFile(
        dirname(path),
        file,
        partitioned,
      );
      return {
        input: file.input,
        markdown: file.markdown,
        format: file.format,
        file: file.file,
        supporting: file.supporting,
        resourceFiles,
      };
    }),
    error: result.error,
  };
}

export function pandocMetadataPath(path: string) {
  return pathWithForwardSlashes(path);
}

export function resourceFilesFromRenderedFile(
  baseDir: string,
  renderedFile: RenderedFile,
  partitioned?: PartitionedMarkdown,
) {
  const resourceDir = join(baseDir, dirname(renderedFile.file));
  const markdown = partitioned ? partitioned.markdown : "";
  const globs = renderedFile.resourceFiles.globs;
  const fileResourceFiles = resolveFileResources(
    baseDir,
    resourceDir,
    markdown,
    globs,
  );

  // add the explicitly discovered files (if they exist and
  // the output isn't self-contained)
  if (!renderedFile.selfContained) {
    const resultFiles = renderedFile.resourceFiles.files
      .map((file) => join(resourceDir, file))
      .filter(existsSync)
      .map(Deno.realPathSync);
    fileResourceFiles.include.push(...resultFiles);
  }

  // apply removes and filter files dir
  const resourceFiles = fileResourceFiles.include.filter(
    (file: string) => {
      if (fileResourceFiles.exclude.includes(file)) {
        return false;
      } else if (
        renderedFile.supporting &&
        renderedFile.supporting.some((support) =>
          file.startsWith(join(baseDir, support))
        )
      ) {
        return false;
      } else {
        return true;
      }
    },
  );
  return resourceFiles;
}
