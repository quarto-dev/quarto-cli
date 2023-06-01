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

const contributors: Record<RenderType, NotebookContributor | undefined> = {
  [kJatsSubarticle]: jatsContributor,
  [kHtmlPreview]: undefined,
  [kRenderedIPynb]: undefined,
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
        [kJatsSubarticle]: output,
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

  return {
    get: (nbAbsPath: string) => {
      return notebooks[nbAbsPath];
    },
    resolve: (
      nbAbsPath: string,
      renderType: RenderType,
      executedFile: ExecutedFile,
    ) => {
      return contributor(renderType).resolve(nbAbsPath, token(), executedFile);
    },
    contribute,
    render: async (
      nbAbsPath: string,
      renderType: RenderType,
      services: RenderServices,
      project?: ProjectContext,
    ) => {
      const renderedFile = await contributor(renderType).render(
        nbAbsPath,
        token(),
        services,
        project,
      );
      contribute(nbAbsPath, kJatsSubarticle, renderedFile);
      return notebooks[nbAbsPath];
    },
    cleanup: () => {
      Object.keys(contributors).forEach((renderType) => {
        contributor(renderType as RenderType).cleanup(Object.values(notebooks));
      });
    },
  };
}
