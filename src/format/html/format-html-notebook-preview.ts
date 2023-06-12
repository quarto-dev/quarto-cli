/*
 * format-html-notebook-preview.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { asArray } from "../../core/array.ts";
import * as ld from "../../core/lodash.ts";

import {
  kDownloadUrl,
  kNotebookPreviewOptions,
} from "../../config/constants.ts";
import { Format, NotebookPreviewDescriptor } from "../../config/types.ts";

import { RenderServices } from "../../command/render/types.ts";

import { basename, dirname, isAbsolute, join, relative } from "path/mod.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";
import { ProjectContext } from "../../project/types.ts";
import { projectIsBook } from "../../project/project-shared.ts";
import {
  kHtmlPreview,
  NotebookPreviewOptions,
} from "../../render/notebook/notebook-types.ts";
import { kRenderedIPynb } from "../../render/notebook/notebook-types.ts";
import { InternalError } from "../../core/lib/error.ts";

export interface NotebookPreview {
  title: string;
  href: string;
  filename?: string;
  supporting?: string[];
  resources?: string[];
}

export interface NotebookPreviewTask {
  input: string;
  nbPath: string;
  title?: string;
  nbPreviewFile?: string;
  callback?: (nbPreview: NotebookPreview) => void;
}

export const notebookPreviewer = (
  nbView: boolean | NotebookPreviewDescriptor | NotebookPreviewDescriptor[],
  format: Format,
  services: RenderServices,
  project?: ProjectContext,
) => {
  const isBook = projectIsBook(project);
  const previewQueue: NotebookPreviewTask[] = [];

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
  const descriptor = (
    notebook: string,
  ) => {
    return nbDescriptors[notebook];
  };

  const enQueuePreview = (
    input: string,
    nbPath: string,
    title?: string,
    nbPreviewFile?: string,
    callback?: (nbPreview: NotebookPreview) => void,
  ) => {
    // Try to provide a title
    const nbDesc = descriptor(nbPath);
    const resolvedTitle = title || nbDesc?.title;
    previewQueue.push({
      input,
      nbPath,
      title: resolvedTitle,
      nbPreviewFile,
      callback,
    });
  };

  const renderPreviews = async (output?: string) => {
    const rendered: Record<string, NotebookPreview> = {};

    const nbOptions = format
      .metadata[kNotebookPreviewOptions] as NotebookPreviewOptions;

    const total = previewQueue.length;
    for (let i = 0; i < total; i++) {
      const work = previewQueue[i];
      const { nbPath, input, title, nbPreviewFile } = work;

      const nbDir = dirname(nbPath);
      const filename = basename(nbPath);
      const inputDir = dirname(input);

      if (nbView !== false) {
        // Read options for this notebook
        const descriptor: NotebookPreviewDescriptor | undefined =
          nbDescriptors[nbPath];
        const nbAbsPath = isAbsolute(nbPath) ? nbPath : join(inputDir, nbPath);
        const nbContext = services.notebook;
        const notebook = nbContext.get(nbAbsPath);
        const supporting: string[] = [];
        const resources: string[] = [];

        // Ensure this has an rendered ipynb and an html preview
        if (!notebook || !notebook[kHtmlPreview] || !notebook[kRenderedIPynb]) {
          // Render an ipynb if needed
          if (
            (!notebook || !notebook[kRenderedIPynb]) &&
            !descriptor?.[kDownloadUrl]
          ) {
            const renderedIpynb = await nbContext.render(
              nbAbsPath,
              format,
              kRenderedIPynb,
              services,
              {
                title: title || basename(nbAbsPath),
                filename: basename(nbAbsPath),
              },
              undefined,
              project,
            );
            if (renderedIpynb && renderedIpynb.output) {
              nbContext.preserve(nbAbsPath, kRenderedIPynb);
              supporting.push(...renderedIpynb.output.path);
              supporting.push(...renderedIpynb.output.supporting);
              resources.push(...renderedIpynb.output.resourceFiles.files);
            }
          }

          // Render the HTML preview, if needed
          if (!notebook || !notebook[kHtmlPreview]) {
            const backHref = nbOptions && nbOptions.back && output
              ? relative(dirname(nbAbsPath), output)
              : undefined;

            let downloadHref = nbAbsPath;
            if (notebook && notebook[kRenderedIPynb].output) {
              downloadHref = notebook[kRenderedIPynb].output.path;
            }

            const htmlPreview = await nbContext.render(
              nbAbsPath,
              format,
              kHtmlPreview,
              services,
              {
                title: title || basename(nbAbsPath),
                filename: basename(nbAbsPath),
                backHref,
                downloadHref,
                downloadFile: basename(nbAbsPath),
              },
              nbPreviewFile,
              project,
            );
            if (htmlPreview.output) {
              nbContext.preserve(nbAbsPath, kHtmlPreview);
              supporting.push(...htmlPreview.output.path);
              supporting.push(...htmlPreview.output.supporting);
              resources.push(...htmlPreview.output.resourceFiles.files);
            }
          }
        }

        const renderedNotebook = nbContext.get(nbAbsPath);
        if (!renderedNotebook || !renderedNotebook[kHtmlPreview].output) {
          throw new InternalError(
            "We just ensured that notebooks had rendered previews, but the preview then didn't exist.",
          );
        }

        // Compute the final preview information that will be used
        // to form links to this notebook
        const nbPreview = {
          title: title || renderedNotebook[kHtmlPreview].metadata?.title ||
            basename(renderedNotebook[kHtmlPreview].output.path),
          href: relative(inputDir, renderedNotebook[kHtmlPreview].output.path),
          supporting,
          resources,
        };
        rendered[work.nbPath] = nbPreview;
        if (work.callback) {
          work.callback(nbPreview);
        }
      } else {
        const nbPreview = {
          href: pathWithForwardSlashes(join(nbDir, filename)),
          title: title || filename,
          filename,
        };
        rendered[work.nbPath] = nbPreview;
        if (work.callback) {
          work.callback(nbPreview);
        }
      }
    }
    return rendered;
  };

  return {
    enQueuePreview,
    renderPreviews,
    descriptor,
  };
};
