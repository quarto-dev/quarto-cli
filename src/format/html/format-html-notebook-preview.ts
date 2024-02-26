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
import { logProgress } from "../../core/log.ts";

export interface NotebookPreview {
  title: string;
  href: string;
  filename?: string;
  supporting?: string[];
  resources?: string[];
  order?: number;
}

export interface NotebookPreviewTask {
  input: string;
  nbPath: string;
  title?: string;
  nbPreviewFile?: string;
  order?: number;
  callback?: (nbPreview: NotebookPreview) => void;
}

export const notebookPreviewer = (
  nbView: boolean | NotebookPreviewDescriptor | NotebookPreviewDescriptor[],
  format: Format,
  services: RenderServices,
  project: ProjectContext,
) => {
  const isBook = projectIsBook(project);
  const previewQueue: NotebookPreviewTask[] = [];
  const outputDir = project?.config?.project["output-dir"];

  const nbDescriptors: Record<string, NotebookPreviewDescriptor> = {};
  if (nbView) {
    if (typeof nbView !== "boolean") {
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
    nbAbsPath: string,
    title?: string,
    order?: number,
    callback?: (nbPreview: NotebookPreview) => void,
  ) => {
    if (
      !previewQueue.find((work) => {
        return work.nbPath === nbAbsPath;
      })
    ) {
      // Try to provide a title
      previewQueue.push({
        input,
        nbPath: nbAbsPath,
        title: title,
        callback,
        order,
      });
    }
  };

  const renderPreviews = async (output?: string, quiet?: boolean) => {
    const rendered: Record<string, NotebookPreview> = {};

    const nbOptions = format
      .metadata[kNotebookPreviewOptions] as NotebookPreviewOptions;

    const notebookPaths = previewQueue.map((work) => (work.nbPath));
    const uniquePaths = ld.uniq(notebookPaths);
    const toRenderPaths = uniquePaths.filter((nbPath) => {
      return services.notebook.get(nbPath, project) === undefined;
    });
    const haveRenderedPaths: string[] = [];
    if (toRenderPaths.length > 0 && !quiet) {
      logProgress(
        `Rendering notebook previews`,
      );
    }
    const total = previewQueue.length;
    let renderCount = 0;
    for (let i = 0; i < total; i++) {
      const work = previewQueue[i];
      const { nbPath, input, title } = work;
      if (
        toRenderPaths.includes(nbPath) && !haveRenderedPaths.includes(nbPath) &&
        !quiet
      ) {
        logProgress(
          `[${++renderCount}/${toRenderPaths.length}] ${basename(nbPath)}`,
        );
        haveRenderedPaths.push(nbPath);
      }

      const nbDir = dirname(nbPath);
      const filename = basename(nbPath);
      const inputDir = dirname(input);

      if (nbView !== false) {
        // Read options for this notebook
        const descriptor: NotebookPreviewDescriptor | undefined =
          nbDescriptors[relative(dirname(input), nbPath)];
        const nbAbsPath = isAbsolute(nbPath) ? nbPath : join(inputDir, nbPath);
        const nbContext = services.notebook;
        const notebook = nbContext.get(nbAbsPath, project);

        const resolvedTitle = descriptor?.title || title ||
          notebook?.metadata?.title || basename(nbAbsPath);

        const notebookIsQmd = !nbAbsPath.endsWith(".ipynb");

        // Ensure this has an rendered ipynb and an html preview
        if (!notebook || !notebook[kHtmlPreview] || !notebook[kRenderedIPynb]) {
          // Render an ipynb if needed
          if (
            (!notebook || !notebook[kRenderedIPynb]) &&
            !descriptor?.[kDownloadUrl] &&
            !isBook &&
            !notebookIsQmd
          ) {
            const renderedIpynb = await nbContext.render(
              nbAbsPath,
              format,
              kRenderedIPynb,
              services,
              {
                title: resolvedTitle,
                filename: basename(nbAbsPath),
              },
              project,
            );
            if (renderedIpynb && (!project || !outputDir)) {
              nbContext.preserve(nbAbsPath, kRenderedIPynb);
            }
          }

          // Render the HTML preview, if needed
          if (!notebook || !notebook[kHtmlPreview]) {
            const backHref = nbOptions && nbOptions.back && output
              ? relative(dirname(nbAbsPath), output)
              : undefined;

            let downloadHref = basename(nbAbsPath);
            let downloadFileName = basename(nbAbsPath);
            // If this is an ipynb and there is a rendered version of it
            // use that instead.
            if (
              notebook && notebook[kRenderedIPynb] &&
              !notebookIsQmd
            ) {
              downloadHref = relative(
                dirname(nbAbsPath),
                notebook[kRenderedIPynb].hrefPath,
              );
              downloadFileName = basename(notebook[kRenderedIPynb].hrefPath);
            }

            const htmlPreview = await nbContext.render(
              nbAbsPath,
              format,
              kHtmlPreview,
              services,
              {
                title: resolvedTitle,
                filename: basename(nbAbsPath),
                backHref,
                downloadHref,
                downloadFile: downloadFileName,
              },
              project,
            );
            if (htmlPreview && (!project || !outputDir)) {
              nbContext.preserve(nbAbsPath, kHtmlPreview);
            }
          }
        }

        const renderedNotebook = nbContext.get(nbAbsPath, project);
        if (!renderedNotebook || !renderedNotebook[kHtmlPreview]) {
          throw new InternalError(
            "We just ensured that notebooks had rendered previews, but the preview then didn't exist.",
          );
        }

        // Forward along resources and supporting files from previews
        const supporting: string[] = [];
        const resources: string[] = [];
        if (renderedNotebook[kRenderedIPynb]) {
          const renderedIpynb = renderedNotebook[kRenderedIPynb];
          if (renderedIpynb) {
            if (project) {
              supporting.push(
                relative(project.dir, renderedIpynb.hrefPath),
              );
            } else {
              supporting.push(renderedIpynb.hrefPath);
            }
            supporting.push(...renderedIpynb.supporting);
            resources.push(...renderedIpynb.resourceFiles.files);
          }
        }

        if (renderedNotebook[kHtmlPreview]) {
          const htmlPreview = renderedNotebook[kHtmlPreview];
          if (htmlPreview) {
            if (project) {
              supporting.push(relative(project.dir, htmlPreview.hrefPath));
            } else {
              supporting.push(htmlPreview.hrefPath);
            }
            supporting.push(...htmlPreview.supporting);
            resources.push(...htmlPreview.resourceFiles.files);
          }
        }

        // Compute the final preview information that will be used
        // to form links to this notebook
        const nbPreview = {
          title: resolvedTitle,
          href: relative(inputDir, renderedNotebook[kHtmlPreview].hrefPath),
          supporting,
          resources,
          order: work.order,
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
          order: work.order,
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
