/*
 * book-extension.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, join } from "../../../deno_ral/path.ts";

import { Format } from "../../../config/types.ts";

import { RenderedFile } from "../../../command/render/types.ts";

import { kOutputFile } from "../../../config/constants.ts";

import { defaultWriterFormat } from "../../../format/formats.ts";

import { ProjectConfig, ProjectContext } from "../../types.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { inputTargetIndex } from "../../project-index.ts";
import { bookConfigRenderItems } from "./book-config.ts";
import { BookRenderItem } from "./book-types.ts";
import { isHtmlOutput } from "../../../config/format.ts";
import { BookExtension, isMultiFileBookFormat } from "./book-shared.ts";

export function onSingleFileBookPreRender(
  format: Format,
  config?: ProjectConfig,
): Format {
  const extension = format.extensions?.book as BookExtension;
  if (extension && extension.onSingleFilePreRender) {
    extension.onSingleFilePreRender(format, config);
  }
  return format;
}

export function onSingleFileBookPostRender(
  project: ProjectContext,
  file: RenderedFile,
) {
  const extension = file.format.extensions?.book as BookExtension;
  if (extension && extension.onSingleFilePostRender) {
    extension.onSingleFilePostRender(project, file);
  }
}

export async function bookMultiFileHtmlOutputs(
  context: ProjectContext,
): Promise<string[]> {
  // get all render targets for the book
  const renderFiles = bookConfigRenderItems(context.config).filter((
    item: BookRenderItem,
  ) => !!item.file);

  // if there are no render files then return empty
  if (renderFiles.length === 0) {
    return [];
  }

  // find the name of the multi-file html format
  const index = await inputTargetIndex(context, renderFiles[0].file!);
  if (!index) {
    return [];
  }

  const formatName = Object.keys(index.formats).find((name) => {
    if (isMultiFileBookFormat(defaultWriterFormat(name))) {
      const format = index.formats[name];
      return isHtmlOutput(format.pandoc, true) && !!format.pandoc[kOutputFile];
    } else {
      return false;
    }
  });
  if (!formatName) {
    return [];
  }

  // find all of the output files for this format
  const outputFiles: string[] = [];
  for (let i = 0; i < renderFiles.length; i++) {
    const file = renderFiles[i].file!;
    const index = await inputTargetIndex(context, file);
    const outputFile = index?.formats[formatName].pandoc[kOutputFile];
    if (outputFile) {
      outputFiles.push(
        join(projectOutputDir(context), dirname(file), outputFile),
      );
    }
  }

  return outputFiles;
}
