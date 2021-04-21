/*
* format-epub.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Format } from "../../config/format.ts";
import { mergeConfigs } from "../../core/config.ts";
import { createEbookFormat } from "../formats.ts";
import { epubBookExtension } from "./format-epub-book.ts";

export function epubFormat(): Format {
  return mergeConfigs(
    createEbookFormat("epub"),
    {
      extensions: {
        book: epubBookExtension,
      },
    },
  );
}
