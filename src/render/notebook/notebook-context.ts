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
  RenderType,
} from "./notebook-types.ts";

import { basename, dirname, join } from "path/mod.ts";
import { jatsContributor } from "./notebook-contributor-jats.ts";
import { htmlNotebookContributor } from "./notebook-contributor-html.ts";
import { outputNotebookContributor } from "./notebook-contributor-ipynb.ts";
import { Format } from "../../config/types.ts";

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

  const contribute = (
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

    const nb = notebooks[nbAbsPath];
    if (nb) {
      nb[renderType] = output;
    } else {
      notebooks[nbAbsPath] = {
        source: nbAbsPath,
        title: "",
        [renderType]: output,
      };
    }
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

  function renderedNotebook(nbPath: string) {
    const currentNb = notebooks[nbPath];
    const outputNotebook = currentNb && currentNb[kRenderedIPynb]
      ? currentNb[kRenderedIPynb]
      : undefined;
    return outputNotebook;
  }

  return {
    get: (nbAbsPath: string) => {
      return notebooks[nbAbsPath];
    },
    resolve: (
      nbAbsPath: string,
      parentFilePath: string,
      renderType: RenderType,
      executedFile: ExecutedFile,
    ) => {
      return contributor(renderType).resolve(
        nbAbsPath,
        parentFilePath,
        token(),
        executedFile,
        renderedNotebook(nbAbsPath),
      );
    },
    contribute,
    render: async (
      nbAbsPath: string,
      parentFilePath: string,
      format: Format,
      renderType: RenderType,
      services: RenderServices,
      project?: ProjectContext,
    ) => {
      const renderedFile = await contributor(renderType).render(
        nbAbsPath,
        parentFilePath,
        format,
        token(),
        services,
        renderedNotebook(nbAbsPath),
        project,
      );
      contribute(nbAbsPath, kJatsSubarticle, renderedFile);
      return notebooks[nbAbsPath];
    },
    cleanup: () => {
      const hasNotebooks = Object.keys(notebooks).length > 0;
      if (hasNotebooks) {
        Object.keys(contributors).forEach((renderType) => {
          contributor(renderType as RenderType).cleanup(
            Object.values(notebooks),
          );
        });
      }
    },
  };
}
