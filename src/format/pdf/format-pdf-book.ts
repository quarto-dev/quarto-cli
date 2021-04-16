/*
* format-pdf-book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ExecutedFile } from "../../command/render/render.ts";
import { RenderedFile, RenderOptions } from "../../command/render/render.ts";
import { ProjectContext } from "../../project/project-context.ts";

export function renderPdfBook(
  _project: ProjectContext,
  _options: RenderOptions,
  _files: ExecutedFile[],
): Promise<RenderedFile[]> {
  console.log("rendering pdf book");
  return Promise.resolve([]);
}
