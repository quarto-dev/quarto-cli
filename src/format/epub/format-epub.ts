/*
* format-epub.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Format } from "../../config/format.ts";
import { mergeConfigs } from "../../core/config.ts";
import { BookExtension } from "../../project/types/book/book-extension.ts";
import { createEbookFormat } from "../formats.ts";
import { renderEpubBook } from "./format-epub-book.ts";

export function epubFormat(): Format {
  const bookExtension: BookExtension = {
    renderPandoc: renderEpubBook,
  };

  return mergeConfigs(
    createEbookFormat("epub"),
    {
      extensions: {
        book: bookExtension,
      },
    },
  );
}
