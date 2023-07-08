/*
 * format-typst.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "path/mod.ts";

import { RenderServices } from "../../command/render/types.ts";
import {
  kCiteproc,
  kColumns,
  kDefaultImageExtension,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kNumberSections,
  kSectionNumbering,
  kShiftHeadingLevelBy,
  kVariables,
  kVariant,
  kWrap,
} from "../../config/constants.ts";
import {
  Format,
  FormatExtras,
  FormatPandoc,
  Metadata,
  PandocFlags,
} from "../../config/types.ts";
import { formatResourcePath } from "../../core/resources.ts";
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
      [kWrap]: "none",
      [kCiteproc]: false,
      // TODO: Patch to do what Pandoc > 3.1.2 will do next when `+citations` (the default) is set.
      [kVariables]: {
        citations: true,
      },
    },
    resolveFormat: typstResolveFormat,
    formatExtras: (
      _input: string,
      markdown: string,
      flags: PandocFlags,
      format: Format,
      _libDir: string,
      _services: RenderServices,
    ): FormatExtras => {
      const pandoc: FormatPandoc = {};
      const metadata: Metadata = {};

      // provide default section numbering if required
      if (
        (flags?.[kNumberSections] === true ||
          format.pandoc[kNumberSections] === true)
      ) {
        // number-sections imples section-numbering
        if (!format.metadata?.[kSectionNumbering]) {
          metadata[kSectionNumbering] = "1.1.a";
        }
      }

      // unless otherwise specified, pdfs with only level 2 or greater headings get their
      // heading level shifted by -1.
      const hasLevelOneHeadings = !!markdown.match(/\n^#\s.*$/gm);
      if (
        !hasLevelOneHeadings &&
        flags?.[kShiftHeadingLevelBy] === undefined &&
        format.pandoc?.[kShiftHeadingLevelBy] === undefined
      ) {
        pandoc[kShiftHeadingLevelBy] = -1;
      }

      // force columns to wrap and move any 'columns' setting to metadata
      const columns = format.pandoc[kColumns];
      if (columns) {
        pandoc[kColumns] = undefined;
        metadata[kColumns] = columns;
      }

      // Provide a template and partials
      const templateDir = formatResourcePath("typst", join("pandoc", "quarto"));
      const templateContext = {
        template: join(templateDir, "template.typ"),
        partials: [
          "definitions.typ",
          "typst-template.typ",
          "typst-show.typ",
          "notes.typ",
          "biblio.typ",
        ].map((partial) => join(templateDir, partial)),
      };

      return {
        pandoc,
        metadata,
        templateContext,
      };
    },
  });
}

function typstResolveFormat(format: Format) {
  // Pandoc citeproc with typst output requires adjustment
  // https://github.com/jgm/pandoc/commit/e89a3edf24a025d5bb0fe8c4c7a8e6e0208fa846
  if (format.pandoc?.[kCiteproc] === true) {
    // citeproc: false is the default, so user setting it to true means they want to use
    // Pandoc's citeproc which requires `citations` extensions to be disabled (e.g typst-citations)
    format.render[kVariant] = [format.render?.[kVariant], "-citations"].join(
      "",
    );
    format.pandoc[kVariables] = format.pandoc[kVariables] || {};
    format.pandoc[kVariables]["citations"] = false;
  }
}
