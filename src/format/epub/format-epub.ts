/*
* format-epub.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { Format } from "../../config/types.ts";
import { ProjectConfig } from "../../project/types.ts";
import { kEPubCoverImage, kHtmlMathMethod } from "../../config/constants.ts";

import { mergeConfigs } from "../../core/config.ts";

import {
  bookConfig,
  BookExtension,
  kBookCoverImage,
} from "../../project/types/book/book-shared.ts";
import { createEbookFormat } from "../formats-shared.ts";

export function epubFormat(to: string): Format {
  return mergeConfigs(
    createEbookFormat("ePub", "epub"),
    {
      pandoc: {
        [kHtmlMathMethod]: to === "epub2" ? "webtex" : "mathml",
      },
      extensions: {
        book: epubBookExtension,
      },
    },
  );
}

const epubBookExtension: BookExtension = {
  selfContainedOutput: true,
  onSingleFilePreRender: (format: Format, config?: ProjectConfig): Format => {
    // derive epub-cover-image from cover-image if not explicitly specified
    if (!format.pandoc[kEPubCoverImage] && !format.metadata[kBookCoverImage]) {
      // is there a cover-image?
      const coverImage = bookConfig(kBookCoverImage, config) as
        | string
        | undefined;
      if (coverImage) {
        format.metadata[kBookCoverImage] = coverImage;
      }
    }

    return format;
  },
};
