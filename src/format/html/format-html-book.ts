/*
* format-html-book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ExecutedFile, renderPandoc } from "../../command/render/render.ts";
import { RenderedFile, RenderOptions } from "../../command/render/render.ts";
import { ProjectContext } from "../../project/project-context.ts";

export async function renderHtmlBook(
  _project: ProjectContext,
  _options: RenderOptions,
  files: ExecutedFile[],
): Promise<RenderedFile[]> {
  const renderedFiles: RenderedFile[] = [];

  for (const file of files) {
    renderedFiles.push(await renderPandoc(file));
  }

  return renderedFiles;
}
