/*
 * notebook-contributor-html.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { renderFiles } from "../../command/render/render-files.ts";
import {
  ExecutedFile,
  RenderedFile,
  RenderServices,
} from "../../command/render/types.ts";
import {
  kClearHiddenClasses,
  kFormatLinks,
  kKeepHidden,
  kNotebookPreserveCells,
  kNotebookPreviewBack,
  kNotebookPreviewDownload,
  kNotebookViewStyle,
  kOutputFile,
  kRemoveHidden,
  kTemplate,
  kTheme,
  kTo,
  kToc,
  kUnrollMarkdownCells,
} from "../../config/constants.ts";
import { InternalError } from "../../core/lib/error.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  NotebookContributor,
  NotebookMetadata,
  NotebookTemplateMetadata,
} from "./notebook-types.ts";

import * as ld from "../../core/lodash.ts";

import { error } from "log/mod.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { kNotebookViewStyleNotebook } from "../../format/html/format-html-constants.ts";
import { kAppendixStyle } from "../../format/html/format-html-shared.ts";
import { basename, join } from "path/mod.ts";
import { Format } from "../../config/types.ts";

export const htmlNotebookContributor: NotebookContributor = {
  resolve: resolveHtmlNotebook,
  render: renderHtmlNotebook,
  outputFile,
};

export function outputFile(
  nbAbsPath: string,
): string {
  return `${basename(nbAbsPath)}.html`;
}

function resolveHtmlNotebook(
  nbAbsPath: string,
  _token: string,
  executedFile: ExecutedFile,
  notebookMetadata?: NotebookMetadata,
) {
  const resolved = ld.cloneDeep(executedFile) as ExecutedFile;

  // Set the output file
  resolved.recipe.format.pandoc[kOutputFile] = `${basename(nbAbsPath)}.html`;
  resolved.recipe.output = resolved.recipe.format.pandoc[kOutputFile];

  // Configure echo for this rendering to ensure there is output
  // that we can manually control
  resolved.recipe.format.execute.echo = false;
  resolved.recipe.format.execute.warning = false;
  resolved.recipe.format.render[kKeepHidden] = true;
  resolved.recipe.format.metadata[kClearHiddenClasses] = "all";
  resolved.recipe.format.metadata[kRemoveHidden] = "none";

  // Use the special `embed/notebook` template for this render
  const template = formatResourcePath(
    "html",
    join("embed", "template.html"),
  );
  resolved.recipe.format.pandoc[kTemplate] = template;

  // Metadata used by template when rendering
  resolved.recipe.format.metadata["nbMeta"] = {
    ...notebookMetadata,
    downloadLabel: resolved.recipe.format.language[kNotebookPreviewDownload],
    backLabel: resolved.recipe.format.language[kNotebookPreviewBack],
  } as NotebookTemplateMetadata;

  // Configure the notebook style
  resolved.recipe.format.render[kNotebookViewStyle] =
    kNotebookViewStyleNotebook;
  resolved.recipe.format.render[kNotebookPreserveCells] = true;
  resolved.recipe.format.metadata[kUnrollMarkdownCells] = false;

  // Configure the appearance
  resolved.recipe.format.pandoc[kToc] = false;
  resolved.recipe.format.metadata[kAppendixStyle] = "none";
  resolved.recipe.format.render[kFormatLinks] = false;

  return resolved;
}

async function renderHtmlNotebook(
  nbPath: string,
  format: Format,
  _subArticleToken: string,
  services: RenderServices,
  notebookMetadata?: NotebookMetadata,
  project?: ProjectContext,
): Promise<RenderedFile> {
  // Use the special `embed` template for this render
  const template = formatResourcePath(
    "html",
    join("embed", "template.html"),
  );

  // Render the notebook and update the path
  const rendered = await renderFiles(
    [{ path: nbPath, formats: ["html"] }],
    {
      services,
      flags: {
        metadata: {
          [kTo]: "html",
          [kTheme]: format.metadata[kTheme],
          [kOutputFile]: `${basename(nbPath)}.html`,
          [kTemplate]: template,
          [kNotebookViewStyle]: kNotebookViewStyleNotebook,
          [kAppendixStyle]: "none",
          [kNotebookPreserveCells]: true,
          ["nbMeta"]: {
            ...notebookMetadata,
            downloadLabel: format.language[kNotebookPreviewDownload],
            backLabel: format.language[kNotebookPreviewBack],
          } as NotebookTemplateMetadata,
        },
        quiet: false,
      },
      echo: true,
      warning: true,
      quietPandoc: true,
    },
    [],
    undefined,
    project,
  );

  // An error occurred rendering this subarticle
  if (rendered.error) {
    error("Rendering of output notebook produced an unexpected result");
    throw (rendered.error);
  }

  // There should be only one file
  if (rendered.files.length !== 1) {
    throw new InternalError(
      `Rendering an output notebook should only result in a single file. This attempt resulted in ${rendered.files.length} file(s).`,
    );
  }

  return rendered.files[0];
}
