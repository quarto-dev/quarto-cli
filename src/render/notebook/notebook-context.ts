/*
 * notebook-context.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ExecutedFile, RenderServices } from "../../command/render/types.ts";
import { InternalError } from "../../core/lib/error.ts";
import { kJatsSubarticle } from "../../format/jats/format-jats-types.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  kHtmlPreview,
  kQmdIPynb,
  kRenderedIPynb,
  Notebook,
  NotebookContext,
  NotebookContributor,
  NotebookMetadata,
  NotebookRenderResult,
  RenderType,
} from "./notebook-types.ts";

import { basename, dirname, join } from "path/mod.ts";
import { jatsContributor } from "./notebook-contributor-jats.ts";
import { htmlNotebookContributor } from "./notebook-contributor-html.ts";
import { outputNotebookContributor } from "./notebook-contributor-ipynb.ts";
import { Format } from "../../config/types.ts";
import { safeExistsSync, safeRemoveIfExists } from "../../core/path.ts";
import { relative } from "path/mod.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { qmdNotebookContributor } from "./notebook-contributor-qmd.ts";
import { debug } from "log/mod.ts";

const contributors: Record<RenderType, NotebookContributor | undefined> = {
  [kJatsSubarticle]: jatsContributor,
  [kHtmlPreview]: htmlNotebookContributor,
  [kRenderedIPynb]: outputNotebookContributor,
  [kQmdIPynb]: qmdNotebookContributor,
};

export function notebookContext(): NotebookContext {
  const notebooks: Record<string, Notebook> = {};
  const preserveNotebooks: Record<string, RenderType[]> = {};
  let nbCount = 0;

  const token = () => {
    return `nb-${++nbCount}`;
  };

  const emptyNotebook = (nbAbsPath: string): Notebook => {
    return {
      source: nbAbsPath,
    };
  };

  // Adds a rendering of a notebook to the notebook context
  const addRendering = (
    nbAbsPath: string,
    renderType: RenderType,
    result: NotebookRenderResult,
  ) => {
    debug(`[NotebookContext]: Add Rendering (${renderType}):${nbAbsPath}`);
    const absPath = join(dirname(nbAbsPath), basename(result.file));
    const output = {
      path: absPath,
      supporting: result.supporting || [],
      resourceFiles: result.resourceFiles,
    };

    const nb: Notebook = notebooks[nbAbsPath] || emptyNotebook(nbAbsPath);
    nb[renderType] = output;
    notebooks[nbAbsPath] = nb;
  };

  // Removes a rendering of a notebook from the notebook context
  // which includes cleaning up the files. This should only be
  // used when the caller knows other callers will not need the
  // notebook.
  const removeRendering = (
    nbAbsPath: string,
    renderType: RenderType,
    preserveFiles: string[],
  ) => {
    debug(`[NotebookContext]: Remove Rendering (${renderType}):${nbAbsPath}`);
    if (
      preserveNotebooks[nbAbsPath] &&
      preserveNotebooks[nbAbsPath].includes(renderType)
    ) {
      // Someone asked to preserve this, don't clean it up
      return;
    }
    const nb: Notebook = notebooks[nbAbsPath];
    if (nb) {
      const rendering = nb[renderType];

      if (rendering) {
        safeRemoveIfExists(rendering.path);
        const filteredSupporting = rendering.supporting.filter(
          (file) => {
            const absPath = join(dirname(nbAbsPath), file);
            return !preserveFiles.includes(absPath);
          },
        );
        for (const supporting of filteredSupporting) {
          safeRemoveIfExists(supporting);
        }
      }
    }
  };

  // Get a contribute for a render type
  function contributor(renderType: RenderType) {
    const contributor = contributors[renderType];
    if (contributor) {
      return contributor;
    } else {
      throw new InternalError(
        `Missing contributor ${renderType} when resolving`,
      );
    }
  }

  // Add metadata to a given notebook rendering
  function addMetadata(
    nbAbsPath: string,
    nbMeta: NotebookMetadata,
  ) {
    debug(`[NotebookContext]: Add Notebook Metadata:${nbAbsPath}`);
    const nb: Notebook = notebooks[nbAbsPath] || emptyNotebook(nbAbsPath);
    nb.metadata = nbMeta;
    notebooks[nbAbsPath] = nb;
  }

  function reviveOutput(
    nbAbsPath: string,
    renderType: RenderType,
    nbOutputDir: string,
  ) {
    debug(`[NotebookContext]: Reviving Rendering (${renderType}):${nbAbsPath}`);
    const contrib = contributor(renderType);
    const outFile = contrib.outputFile(nbAbsPath);
    const outPath = join(nbOutputDir, outFile);
    if (safeExistsSync(outPath)) {
      const inputTime = Deno.statSync(nbAbsPath).mtime?.valueOf() || 0;
      const outputTime = Deno.statSync(outPath).mtime?.valueOf() || 0;
      if (inputTime <= outputTime) {
        debug(
          `[NotebookContext]: Revived Rendering (${renderType}):${nbAbsPath}`,
        );
        addRendering(nbAbsPath, renderType, {
          file: outPath,
          supporting: [],
          resourceFiles: {
            globs: [],
            files: [],
          },
        });
      }
    }
  }

  return {
    all: () => {
      return Object.values(notebooks);
    },
    get: (nbAbsPath: string, context?: ProjectContext) => {
      debug(`[NotebookContext]: Get Notebook:${nbAbsPath}`);
      const notebook = notebooks[nbAbsPath];
      const reviveRenders: RenderType[] = [];
      if (notebook) {
        // We already have a notebook, try to complete its renderings
        // by reviving any outputs that are valid
        [kJatsSubarticle, kHtmlPreview, kRenderedIPynb].forEach(
          (renderTypeStr) => {
            const renderType = renderTypeStr as RenderType;
            if (!notebook[renderType]) {
              reviveRenders.push(renderType);
            }
          },
        );
      } else {
        reviveRenders.push(kHtmlPreview);
        reviveRenders.push(kJatsSubarticle);
        reviveRenders.push(kRenderedIPynb);
      }

      if (context) {
        const nbRelative = relative(context.dir, dirname(nbAbsPath));
        const nbOutputDir = join(projectOutputDir(context), nbRelative);

        // See if an up to date rendered result exists for each contributor
        // TODO: consider doing this check only when a render type is requested
        // or at some other time to reduce the frequency (currently revive is being
        // attempted anytime a notebook `get` is called)
        for (const renderType of reviveRenders) {
          reviveOutput(nbAbsPath, renderType, nbOutputDir);
        }
      }
      return notebooks[nbAbsPath];
    },
    addMetadata: (nbAbsPath: string, notebookMetadata: NotebookMetadata) => {
      addMetadata(nbAbsPath, notebookMetadata);
    },
    resolve: (
      nbAbsPath: string,
      renderType: RenderType,
      executedFile: ExecutedFile,
      notebookMetadata?: NotebookMetadata,
    ) => {
      debug(
        `[NotebookContext]: Resolving ExecutedFile (${renderType}):${nbAbsPath}`,
      );
      if (notebookMetadata) {
        addMetadata(nbAbsPath, notebookMetadata);
      }
      return contributor(renderType).resolve(
        nbAbsPath,
        token(),
        executedFile,
        notebookMetadata,
      );
    },
    addRendering,
    removeRendering,
    render: async (
      nbAbsPath: string,
      format: Format,
      renderType: RenderType,
      services: RenderServices,
      notebookMetadata?: NotebookMetadata,
      project?: ProjectContext,
    ) => {
      debug(`[NotebookContext]: Rendering (${renderType}):${nbAbsPath}`);

      if (notebookMetadata) {
        addMetadata(nbAbsPath, notebookMetadata);
      }

      // If there is a source representation of the qmd file
      // we should use that, which will prevent rexecution of the
      // QMD
      const notebook = notebooks[nbAbsPath];
      const toRenderPath = notebook
        ? notebook[kQmdIPynb] ? notebook[kQmdIPynb].path : nbAbsPath
        : nbAbsPath;

      const renderedFile = await contributor(renderType).render(
        toRenderPath,
        format,
        token(),
        services,
        notebookMetadata,
        project,
      );

      addRendering(nbAbsPath, renderType, renderedFile);
      if (!notebooks[nbAbsPath][renderType]) {
        throw new InternalError(
          "We just rendered and contributed a notebook, but it isn't present in the notebook context.",
        );
      }
      return notebooks[nbAbsPath][renderType]!;
    },
    preserve: (nbAbsPath: string, renderType: RenderType) => {
      debug(`[NotebookContext]: Preserving (${renderType}):${nbAbsPath}`);
      preserveNotebooks[nbAbsPath] = preserveNotebooks[nbAbsPath] || [];
      if (!preserveNotebooks[nbAbsPath].includes(renderType)) {
        preserveNotebooks[nbAbsPath].push(renderType);
      }
    },
    cleanup: () => {
      debug(`[NotebookContext]: Starting Cleanup`);
      const hasNotebooks = Object.keys(notebooks).length > 0;
      if (hasNotebooks) {
        Object.keys(contributors).forEach((renderTypeStr) => {
          Object.values(notebooks).forEach((notebook) => {
            const renderType = renderTypeStr as RenderType;
            // Check to see if this is preserved, if it is
            // skip clean up for this notebook and render type
            if (
              !preserveNotebooks[notebook.source] ||
              !preserveNotebooks[notebook.source].includes(renderType)
            ) {
              const notebookOutput = notebook[renderType];
              if (notebookOutput) {
                debug(
                  `[NotebookContext]: Cleanup (${renderType}):${notebook.source}`,
                );
                debug(
                  `[NotebookContext]: Deleting (${notebookOutput.path}`,
                );
                safeRemoveIfExists(notebookOutput.path);
                for (const supporting of notebookOutput.supporting) {
                  safeRemoveIfExists(supporting);
                }
              }
            }
          });
        });
      }
    },
  };
}
