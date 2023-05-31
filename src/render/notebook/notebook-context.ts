/*
 * notebook-context.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { renderFiles } from "../../command/render/render-files.ts";
import { RenderServices } from "../../command/render/types.ts";
import {
  kJatsSubarticleId,
  kKeepMd,
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
import {
  Notebook,
  NotebookContext,
  NotebookOutput,
  RenderType,
} from "./notebook-types.ts";

import { dirname, join } from "path/mod.ts";
import { error } from "log/mod.ts";

export function notebookContext(): NotebookContext {
  const notebooks: Record<string, Notebook> = {};
  let nbCount = 0;

  return {
    get: (nbAbsPath: string) => {
      return notebooks[nbAbsPath];
    },
    render: async (
      nbAbsPath: string,
      renderType: RenderType,
      services: RenderServices,
      project?: ProjectContext,
    ) => {
      switch (renderType) {
        case "jats-subarticle": {
          const token = `nb-${++nbCount}`;
          const [_dir, stem] = dirAndStem(nbAbsPath);
          const outputFile = `${stem}.subarticle.xml`;
          const output = await renderJats(
            nbAbsPath,
            token,
            outputFile,
            services,
            project,
          );
          const nb = notebooks[nbAbsPath];
          if (nb) {
            nb[kJatsSubarticle] = output;
          } else {
            notebooks[nbAbsPath] = {
              source: nbAbsPath,
              title: "",
              [kJatsSubarticle]: output,
            };
          }
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

async function renderJats(
  nbPath: string,
  subArticleToken: string,
  outputFile: string,
  services: RenderServices,
  project?: ProjectContext,
): Promise<NotebookOutput> {
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
          [kKeepMd]: true,
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

  const file = rendered.files[0];
  const absPath = join(dirname(nbPath), file.file);
  return {
    path: absPath,
    supporting: file.supporting || [],
    resourceFiles: file.resourceFiles,
  };
}
