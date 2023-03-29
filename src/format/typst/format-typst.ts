/*
* format-typst.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import {
  kDefaultImageExtension,
  kFigFormat,
  kFigHeight,
  kFigWidth,
} from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { createFormat } from "../formats-shared.ts";

export function typstFormat(): Format {
  return createFormat("Typst", "pdf", {
    execute: {
      [kFigWidth]: 5.5,
      [kFigHeight]: 3.5,
      [kFigFormat]: "svg",
    },
    pandoc: {
      standalone: true,
      [kDefaultImageExtension]: "svg",
    },
  });
}
