/*
 * notebook-contributor-qmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { renderFile } from "../../command/render/render-files.ts";
import {
  ExecutedFile,
  RenderedFile,
  RenderServices,
} from "../../command/render/types.ts";
import {
  kClearHiddenClasses,
  kIpynbProduceSourceNotebook,
  kIPynbTitleBlockTemplate,
  kKeepHidden,
  kNotebookPreserveCells,
  kOutputFile,
  kRemoveHidden,
  kTo,
  kUnrollMarkdownCells,
} from "../../config/constants.ts";
import { InternalError } from "../../core/lib/error.ts";
import { dirAndStem } from "../../core/path.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  NotebookContributor,
  NotebookMetadata,
  NotebookOutput,
} from "./notebook-types.ts";

import * as ld from "../../core/lodash.ts";

import { error } from "log/mod.ts";
import { Format } from "../../config/types.ts";
import { ipynbTitleTemplatePath } from "../../format/ipynb/format-ipynb.ts";
import { projectScratchPath } from "../../project/project-scratch.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { dirname, join, relative } from "path/mod.ts";

export const qmdNotebookContributor: NotebookContributor = {
  resolve: resolveOutputNotebook,
  render: renderOutputNotebook,
  outputFile,
  cache,
  cachedPath,
};

function cache(output: NotebookOutput, project?: ProjectContext) {
  if (project) {
    // copy the embed into the scratch directory
    const path = cachePath(output.path, project);
    ensureDirSync(dirname(path));
    Deno.copyFileSync(output.path, path);
  }
}

function cachedPath(nbAbsPath: string, project?: ProjectContext) {
  if (project) {
    // see if the embed exists in the scratch directory
    const output = outputFile(nbAbsPath);
    const outputPath = join(dirname(nbAbsPath), output);
    const path = cachePath(outputPath, project);
    if (existsSync(path)) {
      return path;
    }
  }
}

function cachePath(nbAbsPath: string, project: ProjectContext) {
  const basePath = projectScratchPath(project.dir, "embed");
  const outputRel = relative(project.dir, nbAbsPath);
  return join(basePath, outputRel);
}

function outputFile(
  nbAbsPath: string,
): string {
  return ipynbOutputFile(nbAbsPath);
}

function resolveOutputNotebook(
  nbAbsPath: string,
  _token: string,
  executedFile: ExecutedFile,
  _notebookMetadata?: NotebookMetadata,
) {
  const resolved = ld.cloneDeep(executedFile);
  resolved.recipe.format.pandoc[kOutputFile] = ipynbOutputFile(nbAbsPath);
  resolved.recipe.output = resolved.recipe.format.pandoc[kOutputFile];

  resolved.recipe.format.pandoc.to = "ipynb";

  // TODO: Allow YAML to pass through as raw or markdown block
  const template = ipynbTitleTemplatePath();

  // Configure echo for this rendering
  resolved.recipe.format.execute.echo = false;
  resolved.recipe.format.execute.warning = false;
  resolved.recipe.format.render[kKeepHidden] = true;
  resolved.recipe.format.render[kNotebookPreserveCells] = true;
  resolved.recipe.format.metadata[kClearHiddenClasses] = "all";
  resolved.recipe.format.metadata[kRemoveHidden] = "none";
  resolved.recipe.format.metadata[kIPynbTitleBlockTemplate] = template;
  resolved.recipe.format.render[kIpynbProduceSourceNotebook] = true;
  resolved.recipe.format.pandoc.citeproc = false;

  // Configure markdown behavior for this rendering
  resolved.recipe.format.metadata[kUnrollMarkdownCells] = false;
  return resolved;
}
async function renderOutputNotebook(
  nbPath: string,
  _format: Format,
  _subArticleToken: string,
  services: RenderServices,
  _notebookMetadata?: NotebookMetadata,
  project?: ProjectContext,
): Promise<RenderedFile> {
  const rendered = await renderFile(
    { path: nbPath, formats: ["ipynb"] },
    {
      services,
      flags: {
        metadata: {
          [kTo]: "ipynb",
          [kOutputFile]: ipynbOutputFile(nbPath),
          [kNotebookPreserveCells]: true,
          [kIpynbProduceSourceNotebook]: true,
          citeproc: false,
        },
        quiet: false,
      },
      echo: true,
      warning: true,
      quietPandoc: true,
    },
    services,
    project,
    false, // Don't enforce project constraints on format since this is an intermediary rendering
  );

  // An error occurred rendering this subarticle
  if (rendered.error) {
    error("Rendering of qmd notebook produced an unexpected result");
    throw (rendered.error);
  }

  // There should be only one file
  if (rendered.files.length !== 1) {
    throw new InternalError(
      `Rendering an qmd notebook should only result in a single file. This attempt resulted in ${rendered.files.length} file(s).`,
    );
  }

  return rendered.files[0];
}

function ipynbOutputFile(nbAbsPath: string) {
  const [_dir, stem] = dirAndStem(nbAbsPath);
  return `${stem}.embed.ipynb`;
}
