/*
* format-typst.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

// TODO: equation numbering and references
// TODO: incremental compile for preview

import { RenderServices } from "../../command/render/types.ts";
import {
  kDefaultImageExtension,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kNumberSections,
  kSectionNumbering,
  kShiftHeadingLevelBy,
} from "../../config/constants.ts";
import { Format, FormatExtras, PandocFlags } from "../../config/types.ts";
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
      [kShiftHeadingLevelBy]: -1,
    },
    formatExtras: (
      _input: string,
      markdown: string,
      flags: PandocFlags,
      format: Format,
      _libDir: string,
      _services: RenderServices,
    ) => {
      const extras: FormatExtras = {};

      if (
        (flags?.[kNumberSections] === true ||
          format.pandoc[kNumberSections] === true)
      ) {
        // number-sections imples section-numbering
        if (!format.metadata?.[kSectionNumbering]) {
          extras.metadata = {
            [kSectionNumbering]: "1.1.a",
          };
        }

        // pdfs with numbered sections and no other level oriented options get
        // their heading level shifted by -1. also don't shift if there are h1
        // headings (nowhere to shift to!)
        const hasLevelOneHeadings = !!markdown.match(/\n^#\s.*$/gm);
        if (
          !hasLevelOneHeadings &&
          flags?.[kShiftHeadingLevelBy] === undefined &&
          format.pandoc?.[kShiftHeadingLevelBy] === undefined
        ) {
          extras.pandoc = {
            [kShiftHeadingLevelBy]: -1,
          };
        }
      }

      return extras;
    },
  });
}
