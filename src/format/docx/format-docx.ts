/*
* format-docx.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Format } from "../../config/format.ts";
import { mergeConfigs } from "../../core/config.ts";
import { createWordprocessorFormat } from "../formats.ts";

export function docxFormat(): Format {
  return mergeConfigs(
    createWordprocessorFormat("docx"),
    {
      extensions: {
        book: {},
      },
    },
  );
}
