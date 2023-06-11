/*
 * notebook-contributor-ipynb.ts
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
  kIPynbTitleBlockTemplate,
  kKeepHidden,
  kOutputFile,
  kRemoveHidden,
  kTo,
  kUnrollMarkdownCells,
} from "../../config/constants.ts";
import { InternalError } from "../../core/lib/error.ts";
import { dirAndStem } from "../../core/path.ts";
import { ProjectContext } from "../../project/types.ts";
import { NotebookContributor, NotebookMetadata } from "./notebook-types.ts";

import * as ld from "../../core/lodash.ts";

import { error } from "log/mod.ts";
import { Format } from "../../config/types.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { join } from "path/mod.ts";

export const outputNotebookContributor: NotebookContributor = {
  resolve: resolveOutputNotebook,
  render: renderOutputNotebook,
};

function resolveOutputNotebook(
  nbAbsPath: string,
  _token: string,
  executedFile: ExecutedFile,
  notebookMetadata?: NotebookMetadata,
) {
  const resolved = ld.cloneDeep(executedFile);
  resolved.recipe.format.pandoc[kOutputFile] = ipynbOutputFile(
    nbAbsPath,
  );
  resolved.recipe.output = resolved.recipe.format.pandoc[kOutputFile];

  resolved.recipe.format.pandoc.to = "ipynb";

  // TODO: Move to shared
  const template = formatResourcePath(
    "ipynb",
    join("templates", "title-block.md"),
  );

  // Configure echo for this rendering
  resolved.recipe.format.execute.echo = false;
  resolved.recipe.format.execute.warning = false;
  resolved.recipe.format.render[kKeepHidden] = true;
  resolved.recipe.format.metadata[kClearHiddenClasses] = "all";
  resolved.recipe.format.metadata[kRemoveHidden] = "none";
  resolved.recipe.format.metadata[kIPynbTitleBlockTemplate] = template;

  // Configure markdown behavior for this rendering
  resolved.recipe.format.metadata[kUnrollMarkdownCells] = false;
  return resolved;
}
async function renderOutputNotebook(
  nbPath: string,
  _format: Format,
  _subArticleToken: string,
  services: RenderServices,
  notebookMetadata?: NotebookMetadata,
  project?: ProjectContext,
): Promise<RenderedFile> {
  const rendered = await renderFiles(
    [{ path: nbPath, formats: ["ipynb"] }],
    {
      services,
      flags: {
        metadata: {
          [kTo]: "ipynb",
          [kOutputFile]: ipynbOutputFile(nbPath),
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

function ipynbOutputFile(nbAbsPath: string) {
  const [_dir, stem] = dirAndStem(nbAbsPath);
  return `${stem}.out.ipynb`;
}
