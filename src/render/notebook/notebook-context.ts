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

  const setTitle = (nbAbsPath: string, title: string) => {
    const nb = notebooks[nbAbsPath];
    if (nb) {
      nb.title = title;
    } else {
      notebooks[nbAbsPath] = {
        source: nbAbsPath,
        title,
      };
    }
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
        (title: string) => {
          setTitle(nbAbsPath, title);
        },
      );
    },
    contribute,
    setTitle,
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
        (title: string) => {
          setTitle(nbAbsPath, title);
        },
        project,
      );

      contribute(nbAbsPath, renderType, renderedFile);
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
            const nbOutput = notebook[renderType as RenderType];
            if (nbOutput) {
              safeRemoveIfExists(nbOutput.path);
              for (const supporting of nbOutput.supporting) {
                safeRemoveIfExists(supporting);
              }
            }
          });
        });
      }
    },
  };
}
