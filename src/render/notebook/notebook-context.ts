/*
 * notebook-context.ts
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
  kJatsSubarticleId,
  kNotebookPreserveCells,
  kOutputFile,
  kTemplate,
  kTo,
} from "../../config/constants.ts";
import { InternalError } from "../../core/lib/error.ts";
import { dirAndStem, safeRemoveIfExists } from "../../core/path.ts";
import {
  kJatsSubarticle,
  kLintXml,
  subarticleTemplatePath,
} from "../../format/jats/format-jats-types.ts";
import { ProjectContext } from "../../project/types.ts";
import { Notebook, NotebookContext, RenderType } from "./notebook-types.ts";

import * as ld from "../../core/lodash.ts";

import { basename, dirname, join } from "path/mod.ts";
import { error } from "log/mod.ts";

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

  return {
    get: (nbAbsPath: string) => {
      return notebooks[nbAbsPath];
    },
    resolve: (
      nbAbsPath: string,
      renderType: RenderType,
      executedFile: ExecutedFile,
    ) => {
      switch (renderType) {
        case kJatsSubarticle: {
          const resolved = ld.cloneDeep(executedFile);
          resolved.recipe.format.metadata[kLintXml] = false;
          resolved.recipe.format.metadata[kJatsSubarticle] = true;
          resolved.recipe.format.metadata[kJatsSubarticleId] = token();
          resolved.recipe.format.pandoc[kOutputFile] = jatsOutputFile(
            nbAbsPath,
          );
          resolved.recipe.output = resolved.recipe.format.pandoc[kOutputFile];
          resolved.recipe.format.pandoc[kTemplate] = subarticleTemplatePath;
          resolved.recipe.format.render[kNotebookPreserveCells] = true;
          return resolved;
        }
      }
    },
    contribute,
    render: async (
      nbAbsPath: string,
      renderType: RenderType,
      services: RenderServices,
      project?: ProjectContext,
    ) => {
      switch (renderType) {
        case kJatsSubarticle: {
          const renderedFile = await renderJats(
            nbAbsPath,
            token(),
            jatsOutputFile(nbAbsPath),
            services,
            project,
          );
          contribute(nbAbsPath, kJatsSubarticle, renderedFile);
          return notebooks[nbAbsPath];
        }
      }
    },
    cleanup: () => {
      for (const notebook of Object.values(notebooks)) {
        if (notebook[kJatsSubarticle]) {
          const subarticle = notebook[kJatsSubarticle];
          // Remove the subarticle
          safeRemoveIfExists(subarticle.path);
        }
      }
    },
  };
}
function jatsOutputFile(nbAbsPath: string) {
  const [_dir, stem] = dirAndStem(nbAbsPath);
  return `${stem}.subarticle.xml`;
}

async function renderJats(
  nbPath: string,
  subArticleToken: string,
  outputFile: string,
  services: RenderServices,
  project?: ProjectContext,
): Promise<RenderedFile> {
  const rendered = await renderFiles(
    [{ path: nbPath, formats: ["jats"] }],
    {
      services,
      flags: {
        metadata: {
          [kTo]: "jats",
          [kLintXml]: false,
          [kJatsSubarticle]: true,
          [kJatsSubarticleId]: subArticleToken,
          [kOutputFile]: outputFile,
          [kTemplate]: subarticleTemplatePath,
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
    error("Rendering of subarticle produced an unexpected result");
    throw (rendered.error);
  }

  // There should be only one file
  if (rendered.files.length !== 1) {
    throw new InternalError(
      `Rendering a JATS subarticle should only result in a single file. This attempt resulted in ${rendered.files.length} file(s).`,
    );
  }

  return rendered.files[0];
}
