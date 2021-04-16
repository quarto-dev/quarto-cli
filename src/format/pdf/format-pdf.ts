/*
* format-pdf.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  kFigDpi,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kShowCode,
  kShowWarnings,
} from "../../config/constants.ts";
import { PandocFlags } from "../../config/flags.ts";
import { Format } from "../../config/format.ts";
import { mergeConfigs } from "../../core/config.ts";
import { createFormat } from "../formats.ts";

export function pdfFormat(): Format {
  return mergeConfigs(
    createPdfFormat(),
    {
      formatExtras: (_flags: PandocFlags, _format: Format) => {
        return {
          book: {},
        };
      },
    },
  );
}

export function beamerFormat(): Format {
  return createFormat(
    "pdf",
    createPdfFormat(),
    {
      execution: {
        [kFigWidth]: 10,
        [kFigHeight]: 7,
        [kShowCode]: false,
        [kShowWarnings]: false,
      },
    },
  );
}

export function latexFormat(): Format {
  return createFormat(
    "tex",
    createPdfFormat(),
  );
}

function createPdfFormat(): Format {
  return createFormat(
    "pdf",
    {
      execution: {
        [kFigWidth]: 6.5,
        [kFigHeight]: 4.5,
        [kFigFormat]: "pdf",
        [kFigDpi]: 300,
      },
      pandoc: {
        standalone: true,
        variables: {
          graphics: true,
          tables: true,
        },
      },
    },
  );
}
