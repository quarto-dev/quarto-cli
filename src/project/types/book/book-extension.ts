/*
* book-extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ExecutedFile, RenderedFile } from "../../../command/render/render.ts";

export interface BookExtension {
  renderPandoc: (files: ExecutedFile[]) => Promise<RenderedFile[]>;
}
