/*
* format-html-book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ExecutedFile, renderPandoc } from "../../command/render/render.ts";
import { RenderedFile } from "../../command/render/render.ts";
import { BookExtension } from "../../project/types/book/book-extension.ts";

export const htmlBookExtension: BookExtension = {
  renderFile: (file: ExecutedFile): Promise<RenderedFile> => {
    return renderPandoc(file);
  },
};
