/*
 * notebook-context.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  ExecutedFile,
  RenderedFile,
  RenderServices,
} from "../../command/render/types.ts";
import { InternalError } from "../../core/lib/error.ts";
import { kJatsSubarticle } from "../../format/jats/format-jats-types.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  kHtmlPreview,
  kRenderedIPynb,
  Notebook,
  NotebookContext,
  NotebookContributor,
  NotebookMetadata,
  RenderType,
} from "./notebook-types.ts";

import { basename, dirname, join } from "path/mod.ts";
import { jatsContributor } from "./notebook-contributor-jats.ts";
import { htmlNotebookContributor } from "./notebook-contributor-html.ts";
import { outputNotebookContributor } from "./notebook-contributor-ipynb.ts";
import { Format } from "../../config/types.ts";
import { safeRemoveIfExists } from "../../core/path.ts";

const contributors: Record<RenderType, NotebookContributor | undefined> = {
  [kJatsSubarticle]: jatsContributor,
  [kHtmlPreview]: htmlNotebookContributor,
  [kRenderedIPynb]: outputNotebookContributor,
};

export function notebookContext(): NotebookContext {
  const notebooks: Record<string, Notebook> = {};
  let nbCount = 0;

  const token = () => {
    return `nb-${++nbCount}`;
  };

  const emptyNotebook = (nbAbsPath: string): Notebook => {
    return {
      source: nbAbsPath,
      [kJatsSubarticle]: {},
      [kHtmlPreview]: {},
      [kRenderedIPynb]: {},
    };
  };

  const addPreview = (
    nbAbsPath: string,
    renderType: RenderType,
    result: RenderedFile,
  ) => {
    const absPath = join(dirname(nbAbsPath), basename(result.file));
    const output = {
      path: absPath,
      supporting: result.supporting || [],
      resourceFiles: result.resourceFiles,
    };

    const nb: Notebook = notebooks[nbAbsPath] || emptyNotebook(nbAbsPath);
    nb[renderType].output = output;
    notebooks[nbAbsPath] = nb;
  };

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

  function addMetadata(
    nbAbsPath: string,
    renderType: RenderType,
    nbMeta?: NotebookMetadata,
  ) {
    const nb: Notebook = notebooks[nbAbsPath] || emptyNotebook(nbAbsPath);
    if (nbMeta) {
      nb[renderType].metadata = nbMeta;
    }
    notebooks[nbAbsPath] = nb;
  }

  return {
    get: (nbAbsPath: string) => {
      return notebooks[nbAbsPath];
    },
    resolve: (
      nbAbsPath: string,
      renderType: RenderType,
      executedFile: ExecutedFile,
      notebookMetadata?: NotebookMetadata,
    ) => {
      addMetadata(nbAbsPath, renderType, notebookMetadata);
      return contributor(renderType).resolve(
        nbAbsPath,
        token(),
        executedFile,
        notebookMetadata,
      );
    },
    addPreview,
    render: async (
      nbAbsPath: string,
      format: Format,
      renderType: RenderType,
      services: RenderServices,
      notebookMetadata?: NotebookMetadata,
      project?: ProjectContext,
    ) => {
      addMetadata(nbAbsPath, renderType, notebookMetadata);
      const renderedFile = await contributor(renderType).render(
        nbAbsPath,
        format,
        token(),
        services,
        notebookMetadata,
        project,
      );

      addPreview(nbAbsPath, renderType, renderedFile);
      if (!notebooks[nbAbsPath][renderType]) {
        throw new InternalError(
          "We just rendered and contributed a notebook, but it isn't present in the notebook context.",
        );
      }
      return notebooks[nbAbsPath][renderType]!;
    },
    cleanup: () => {
      const hasNotebooks = Object.keys(notebooks).length > 0;
      if (hasNotebooks) {
        Object.keys(contributors).forEach((renderType) => {
          Object.values(notebooks).forEach((notebook) => {
            const notebookPreview = notebook[renderType as RenderType];
            if (notebookPreview.output) {
              safeRemoveIfExists(notebookPreview.output.path);
              for (const supporting of notebookPreview.output.supporting) {
                safeRemoveIfExists(supporting);
              }
            }
          });
        });
      }
    },
  };
}
