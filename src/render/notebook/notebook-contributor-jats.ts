/*
 * notebook-contributor-jats.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { renderFile } from "../../command/render/render-files.ts";
import {
  ExecutedFile,
  RenderedFile,
  RenderServices,
} from "../../command/render/types.ts";
import {
  kClearCellOptions,
  kClearHiddenClasses,
  kIpynbProduceSourceNotebook,
  kJatsSubarticleId,
  kKeepHidden,
  kNotebookPreserveCells,
  kOutputFile,
  kRemoveHidden,
  kTemplate,
  kTo,
} from "../../config/constants.ts";
import { InternalError } from "../../core/lib/error.ts";
import { dirAndStem } from "../../core/path.ts";
import {
  kJatsSubarticle,
  kLintXml,
  subarticleTemplatePath,
} from "../../format/jats/format-jats-types.ts";
import { ProjectContext } from "../../project/types.ts";
import { NotebookContributor, NotebookMetadata } from "./notebook-types.ts";

import * as ld from "../../core/lodash.ts";

import { error } from "log/mod.ts";
import { Format } from "../../config/types.ts";

export const jatsContributor: NotebookContributor = {
  resolve: resolveJats,
  render: renderJats,
  outputFile,
};

function outputFile(
  nbAbsPath: string,
): string {
  return jatsOutputFile(nbAbsPath);
}

function resolveJats(
  nbAbsPath: string,
  token: string,
  executedFile: ExecutedFile,
  _notebookMetadata?: NotebookMetadata,
) {
  const resolved = ld.cloneDeep(executedFile);
  resolved.recipe.format.metadata[kLintXml] = false;
  resolved.recipe.format.metadata[kJatsSubarticle] = true;
  resolved.recipe.format.metadata[kJatsSubarticleId] = token;
  resolved.recipe.format.pandoc[kOutputFile] = outputFile(
    nbAbsPath,
  );
  resolved.recipe.output = resolved.recipe.format.pandoc[kOutputFile];
  resolved.recipe.format.pandoc.to = "jats";
  resolved.recipe.format.pandoc[kTemplate] = subarticleTemplatePath;

  // Configure echo for this rendering
  resolved.recipe.format.execute.echo = false;
  resolved.recipe.format.execute.warning = false;
  resolved.recipe.format.render[kKeepHidden] = true;
  resolved.recipe.format.metadata[kClearHiddenClasses] = "all";
  resolved.recipe.format.metadata[kRemoveHidden] = "none";

  // If this recipe is using a a source notebook, clear the cell options
  // from the output when rendering
  if (resolved.recipe.format.render[kIpynbProduceSourceNotebook]) {
    resolved.recipe.format.render[kClearCellOptions] = true;
  }

  return resolved;
}
async function renderJats(
  nbPath: string,
  _format: Format,
  subArticleToken: string,
  services: RenderServices,
  _notebookMetadata?: NotebookMetadata,
  project?: ProjectContext,
): Promise<RenderedFile> {
  const rendered = await renderFile(
    { path: nbPath, formats: ["jats"] },
    {
      services,
      flags: {
        metadata: {
          [kTo]: "jats",
          [kLintXml]: false,
          [kJatsSubarticle]: true,
          [kJatsSubarticleId]: subArticleToken,
          [kOutputFile]: outputFile(nbPath),
          [kTemplate]: subarticleTemplatePath,
          [kNotebookPreserveCells]: true,
          [kNotebookPreserveCells]: true,
        },
        quiet: false,
      },
      echo: true,
      warning: true,
      quietPandoc: true,
    },
    services,
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

function jatsOutputFile(nbAbsPath: string) {
  const [_dir, stem] = dirAndStem(nbAbsPath);
  return `${stem}.subarticle.xml`;
}
