/*
* format-asciidoc.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { Format } from "../../config/types.ts";

import { mergeConfigs } from "../../core/config.ts";

import { plaintextFormat } from "../formats-shared.ts";

export function asciidocFormat(): Format {
  return mergeConfigs(
    plaintextFormat("Asciidoc", "txt"),
    {
      extensions: {
        book: {},
      },
    },
  );
}
