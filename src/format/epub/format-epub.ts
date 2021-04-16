/*
* format-epub.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { PandocFlags } from "../../config/flags.ts";
import { Format } from "../../config/format.ts";
import { mergeConfigs } from "../../core/config.ts";
import { createEbookFormat } from "../formats.ts";

export function epubFormat(): Format {
  return mergeConfigs(
    createEbookFormat("epub"),
    {
      formatExtras: (_flags: PandocFlags, _format: Format) => {
        return {
          book: {},
        };
      },
    },
  );
}
