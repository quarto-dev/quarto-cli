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
  kDownloadUrl,
  kKeepHidden,
  kNotebookPreserveCells,
  kNotebookPreviewBack,
  kNotebookPreviewDownload,
  kNotebookPreviewOptions,
  kNotebookView,
  kNotebookViewStyle,
  kOutputFile,
  kRemoveHidden,
  kTemplate,
  kTheme,
  kTo,
  kUnrollMarkdownCells,
} from "../../config/constants.ts";
import { InternalError } from "../../core/lib/error.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  Notebook,
  NotebookContributor,
  NotebookOutput,
  NotebookPreviewConfig,
  NotebookPreviewOptions,
} from "./notebook-types.ts";

import * as ld from "../../core/lodash.ts";

import { error } from "log/mod.ts";
import { renderEjs } from "../../core/ejs.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { kNotebookViewStyleNotebook } from "../../format/html/format-html-constants.ts";
import { kAppendixStyle } from "../../format/html/format-html-shared.ts";
import { basename, dirname, join, relative } from "path/mod.ts";
import { Format, NotebookPreviewDescriptor } from "../../config/types.ts";
import { asArray } from "../../core/array.ts";
import { readBaseInputIndex } from "../../project/project-index.ts";

export const htmlNotebookContributor: NotebookContributor = {
  resolve: resolveHtmlNotebook,
  render: renderHtmlNotebook,
  cleanup: (_notebooks: Notebook[]) => {
  },
};

async function resolveHtmlNotebook(
  nbAbsPath: string,
  parentFilePath: string,
  _token: string,
  executedFile: ExecutedFile,
  setTitle: (title: string) => void,
  outputNotebook?: NotebookOutput,
) {
  // Resolve notebook configuration
  const nb = await resolveNotebookConfig(
    nbAbsPath,
    parentFilePath,
    executedFile.recipe.format,
    {},
    executedFile.context.project,
  );
  setTitle(nb.config.title);

  // Use the special `embed` template for this render
  const templatePath = htmlPreviewTemplate(
    nbAbsPath,
    executedFile.recipe.format,
    nb.config,
    executedFile.context.options.services,
    outputNotebook,
  );

  const resolved = ld.cloneDeep(executedFile);

  // Set the output file
  resolved.recipe.format.pandoc[kOutputFile] = nb.config.previewFileName;
  resolved.recipe.output = resolved.recipe.format.pandoc[kOutputFile];

  // Configure echo for this rendering
  resolved.recipe.format.execute.echo = false;
  resolved.recipe.format.execute.warning = false;
  resolved.recipe.format.render[kKeepHidden] = true;
  resolved.recipe.format.metadata[kClearHiddenClasses] = "all";
  resolved.recipe.format.metadata[kRemoveHidden] = "none";
  resolved.recipe.format.metadata[kAppendixStyle] = "none";
  resolved.recipe.format.pandoc[kTemplate] = templatePath;
  resolved.recipe.format.render[kNotebookViewStyle] =
    kNotebookViewStyleNotebook;
  resolved.recipe.format.render[kNotebookPreserveCells] = true;

  // Configure markdown behavior for this rendering
  resolved.recipe.format.metadata[kUnrollMarkdownCells] = false;
  return resolved;
}
async function renderHtmlNotebook(
  nbPath: string,
  parentFilePath: string,
  format: Format,
  _subArticleToken: string,
  services: RenderServices,
  setTitle: (title: string) => void,
  outputNotebook?: NotebookOutput,
  project?: ProjectContext,
): Promise<RenderedFile> {
  // Resolve notebook configuration
  const nb = await resolveNotebookConfig(
    nbPath,
    parentFilePath,
    format,
    {},
    project,
  );
  setTitle(nb.config.title);

  // Use the special `embed` template for this render
  const templatePath = htmlPreviewTemplate(
    nbPath,
    format,
    nb.config,
    services,
    outputNotebook,
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
          [kOutputFile]: nb.config.previewFileName,
          [kTemplate]: templatePath,
          [kNotebookViewStyle]: kNotebookViewStyleNotebook,
          [kAppendixStyle]: "none",
          [kNotebookPreserveCells]: true,
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

async function resolveNotebookConfig(
  nbPath: string,
  parentFilePath: string,
  format: Format,
  options: {
    title?: string;
    previewFileName?: string;
  },
  project?: ProjectContext,
) {
  // These are explicitly passed in some cases
  const { title, previewFileName } = options;

  const nbView = format.render[kNotebookView] ?? true;
  const nbDescriptors: Record<string, NotebookPreviewDescriptor> = {};
  if (nbView) {
    if (typeof (nbView) !== "boolean") {
      asArray(nbView).forEach((view) => {
        const existingView = nbDescriptors[view.notebook];
        nbDescriptors[view.notebook] = {
          ...existingView,
          ...view,
        };
      });
    }
  }

  const descriptor: NotebookPreviewDescriptor | undefined =
    nbDescriptors[nbPath];
  const nbOptions = format
    .metadata[kNotebookPreviewOptions] as NotebookPreviewOptions;

  const backHref = nbOptions && nbOptions.back && parentFilePath
    ? relative(dirname(nbPath), parentFilePath)
    : undefined;

  const previewConfig: NotebookPreviewConfig = {
    title: title || await resolveTitle(nbPath, descriptor, project),
    previewFileName: previewFileName || `${basename(nbPath)}.html`,
    url: descriptor?.url,
    downloadUrl: descriptor?.[kDownloadUrl],
    backHref,
  };

  return {
    descriptor,
    options: nbOptions,
    config: previewConfig,
  };
}

async function resolveTitle(
  nbPath: string,
  descriptor: NotebookPreviewDescriptor,
  project?: ProjectContext,
) {
  let resolvedTitle = descriptor?.title; // || title;
  if (!resolvedTitle && project) {
    const inputIndex = await readBaseInputIndex(nbPath, project);
    if (inputIndex) {
      resolvedTitle = inputIndex.title;
    }
  }
  return resolvedTitle || basename(nbPath);
}

function htmlPreviewTemplate(
  nbPath: string,
  format: Format,
  previewConfig: NotebookPreviewConfig,
  services: RenderServices,
  outputNotebook?: NotebookOutput,
) {
  // Use the special `embed` template for this render
  const embedHtmlEjs = formatResourcePath(
    "html",
    join("embed", "template.ejs.html"),
  );
  const downloadPath = outputNotebook
    ? basename(outputNotebook.path)
    : basename(nbPath);
  const downloadFileName = basename(nbPath);

  const embedTemplate = renderEjs(embedHtmlEjs, {
    title: previewConfig.title,
    path: previewConfig.downloadUrl || downloadPath,
    filename: previewConfig.downloadFileName || downloadFileName,
    backOptions: {
      href: previewConfig.backHref,
      label: format.language[kNotebookPreviewBack],
    },
    downloadOptions: {
      label: format.language[kNotebookPreviewDownload],
    },
  });
  const templatePath = services.temp.createFile({ suffix: ".html" });
  Deno.writeTextFileSync(templatePath, embedTemplate);
  return templatePath;
}
