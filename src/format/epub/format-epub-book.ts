/*
* format-epub-book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ExecutedFile } from "../../command/render/render.ts";
import { RenderedFile, RenderOptions } from "../../command/render/render.ts";
import { ProjectContext } from "../../project/project-context.ts";

export function renderEpubBook(
  _project: ProjectContext,
  _options: RenderOptions,
  _files: ExecutedFile[],
): Promise<RenderedFile[]> {
  console.log("rendering epub book");
  return Promise.resolve([]);
}
