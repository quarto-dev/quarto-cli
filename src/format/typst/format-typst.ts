/*
 * format-typst.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "../../deno_ral/path.ts";

import { RenderServices } from "../../command/render/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { BookExtension } from "../../project/types/book/book-shared.ts";
import {
  kBrand,
  kCiteproc,
  kColumns,
  kDefaultImageExtension,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kLight,
  kLogo,
  kNumberSections,
  kSectionNumbering,
  kShiftHeadingLevelBy,
  kVariant,
  kWrap,
} from "../../config/constants.ts";
import {
  Format,
  FormatExtras,
  FormatPandoc,
  LightDarkBrand,
  Metadata,
  PandocFlags,
} from "../../config/types.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { createFormat } from "../formats-shared.ts";
import { hasLevelOneHeadings as hasL1Headings } from "../../core/lib/markdown-analysis/level-one-headings.ts";
import {
  BrandNamedLogo,
  LogoLightDarkSpecifier,
} from "../../resources/types/schema-types.ts";
import {
  brandWithAbsoluteLogoPaths,
  fillLogoPaths,
  resolveLogo,
} from "../../core/brand/brand.ts";
import { LogoLightDarkSpecifierPathOptional } from "../../resources/types/zod/schema-types.ts";

const typstBookExtension: BookExtension = {
  selfContainedOutput: true,
  // multiFile defaults to false (single-file book)
};

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
    },
    extensions: {
      book: typstBookExtension,
    },
    resolveFormat: typstResolveFormat,
    formatExtras: async (
      _input: string,
      markdown: string,
      flags: PandocFlags,
      format: Format,
      _libDir: string,
      _services: RenderServices,
      _offset?: string,
      _project?: ProjectContext,
    ): Promise<FormatExtras> => {
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
      const hasLevelOneHeadings = await hasL1Headings(markdown);
      if (
        !hasLevelOneHeadings &&
        flags?.[kShiftHeadingLevelBy] === undefined &&
        format.pandoc?.[kShiftHeadingLevelBy] === undefined
      ) {
        pandoc[kShiftHeadingLevelBy] = -1;
      }

      const brand = format.render.brand;
      // For Typst, convert brand logo paths to project-absolute (with /)
      // before merging with document logo metadata. Typst resolves / paths
      // via --root which points to the project directory.
      const typstBrand = brandWithAbsoluteLogoPaths(brand);
      const logoSpec = format
        .metadata[kLogo] as LogoLightDarkSpecifierPathOptional;
      const sizeOrder: BrandNamedLogo[] = [
        "small",
        "medium",
        "large",
      ];
      // temporary: if document logo has object or light/dark objects
      // without path, do our own findLogo to add the path
      // typst is the exception not needing path but we'll probably deprecate this
      const logo = fillLogoPaths(typstBrand, logoSpec, sizeOrder);
      format.metadata[kLogo] = resolveLogo(typstBrand, logo, sizeOrder);
      // force columns to wrap and move any 'columns' setting to metadata
      const columns = format.pandoc[kColumns];
      if (columns) {
        pandoc[kColumns] = undefined;
        metadata[kColumns] = columns;
      }

      // Provide a template and partials
      // For Typst books, a book extension overrides these partials
      const templateDir = formatResourcePath("typst", join("pandoc", "quarto"));

      const templateContext = {
        template: join(templateDir, "template.typ"),
        partials: [
          "numbering.typ",
          "definitions.typ",
          "typst-template.typ",
          "page.typ",
          "typst-show.typ",
          "notes.typ",
          "biblio.typ",
        ].map((partial) => join(templateDir, partial)),
      };

      // Postprocessor to fix Skylighting code block styling (issue #14126).
      // Pandoc's generated Skylighting function uses block(fill: bgcolor, blocks)
      // which lacks width, inset, and radius. We surgically fix this in the .typ
      // output. If brand monospace-block has a background-color, we also override
      // the bgcolor value.
      const brandData = (format.render[kBrand] as LightDarkBrand | undefined)
        ?.[kLight];
      const monospaceBlock = brandData?.processedData?.typography?.[
        "monospace-block"
      ];
      let brandBgColor = (monospaceBlock && typeof monospaceBlock !== "string")
        ? monospaceBlock["background-color"] as string | undefined
        : undefined;
      // Resolve palette color names (e.g. "code-bg" → "#1e1e2e")
      if (brandBgColor && brandData?.data?.color?.palette) {
        const palette = brandData.data.color.palette as Record<string, string>;
        let resolved = brandBgColor;
        while (palette[resolved]) {
          resolved = palette[resolved];
        }
        brandBgColor = resolved;
      }

      return {
        pandoc,
        metadata,
        templateContext,
        postprocessors: [
          skylightingPostProcessor(brandBgColor),
        ],
      };
    },
  });
}

// Fix Skylighting code block styling in .typ output (issue #14126).
// The Pandoc-generated Skylighting function uses block(fill: bgcolor, blocks)
// which lacks width, inset, and radius. This postprocessor matches the entire
// Skylighting function by its distinctive signature and patches only within it.
// When brand provides a monospace-block background-color, also overrides the
// bgcolor value. This is a temporary workaround until the fix is upstreamed
// to the Skylighting library.
//
// Additionally patches the Skylighting function for code annotation support:
// adds an annotations parameter, moves line tracking outside the if-number
// block, adds per-line annotation rendering, and routes output through
// quarto-code-block(). Also merges annotation comment markers from the Lua
// filter into Skylighting call sites.
//
// Upstream compatibility: a PR to skylighting-format-typst
// (fix/typst-skylighting-block-style) adds block styling upstream. Once merged
// and picked up by Pandoc, the block styling patch becomes a no-op (the
// replace target won't match). The brand color regex targets rgb("...") which
// works with both current and future upstream bgcolor init patterns.
function skylightingPostProcessor(brandBgColor?: string) {
  // Match the entire #let Skylighting(...) = { ... } function.
  // The signature is stable and generated by Skylighting's Typst backend.
  const skylightingFnRe =
    /(#let Skylighting\(fill: none, number: false, start: 1, sourcelines\) = \{[\s\S]*?\n\})/;

  // Annotation markers emitted by the Lua filter as Typst comments
  const annotationMarkerRe =
    /\/\/ quarto-code-annotations: ([\w-]*) (\([^)]*\))\n(\s*(?:#block\[\s*)*(?:#quarto-code-filename\([^\n]*\)\[\s*)?)#Skylighting\(/g;

  return async (output: string) => {
    let content = Deno.readTextFileSync(output);
    let changed = false;

    const match = skylightingFnRe.exec(content);
    if (match) {
      let fn = match[1];

      // Fix block() call: add width, inset, radius, stroke
      fn = fn.replace(
        "block(fill: bgcolor, blocks)",
        "block(fill: bgcolor, width: 100%, inset: 8pt, radius: 2pt, stroke: 0.5pt + luma(200), blocks)",
      );

      // Override bgcolor with brand monospace-block background-color
      if (brandBgColor) {
        fn = fn.replace(
          /rgb\("[^"]*"\)/,
          `rgb("${brandBgColor}")`,
        );
      }

      // Add cell-id and annotations parameters to function signature
      fn = fn.replace(
        "start: 1, sourcelines)",
        "start: 1, cell-id: \"\", annotations: (:), sourcelines)",
      );

      // Move lnum increment outside if-number block (always track position)
      fn = fn.replace(
        /if number \{\n\s+lnum = lnum \+ 1\n/,
        "lnum = lnum + 1\n     if number {\n",
      );

      // Add annotation rendering per line (derive circle colour from bgcolor)
      fn = fn.replace(
        "blocks = blocks + ln + EndLine()",
        `let annote-num = annotations.at(str(lnum), default: none)
     if annote-num != none {
       if cell-id != "" {
         let lbl = cell-id + "-annote-" + str(annote-num)
         blocks = blocks + box(width: 100%)[#ln #h(1fr) #link(label(lbl))[#quarto-circled-number(annote-num, color: quarto-annote-color(bgcolor))] #label(lbl + "-back")] + EndLine()
       } else {
         blocks = blocks + box(width: 100%)[#ln #h(1fr) #quarto-circled-number(annote-num, color: quarto-annote-color(bgcolor))] + EndLine()
       }
     } else {
       blocks = blocks + ln + EndLine()
     }`,
      );

      if (fn !== match[1]) {
        content = content.replace(match[1], fn);
        changed = true;
      }
    }

    // Merge annotation markers into Skylighting call sites, including
    // optional #block[ wrappers and #quarto-code-filename(...)[ wrappers.
    const merged = content.replace(
      annotationMarkerRe,
      "$3#Skylighting(cell-id: \"$1\", annotations: $2, ",
    );
    if (merged !== content) {
      content = merged;
      changed = true;
    }

    if (changed) {
      Deno.writeTextFileSync(output, content);
    }
  };
}

function typstResolveFormat(format: Format) {
  // Pandoc citeproc with typst output requires adjustment
  // https://github.com/jgm/pandoc/commit/e89a3edf24a025d5bb0fe8c4c7a8e6e0208fa846
  if (
    format.pandoc?.[kCiteproc] === true &&
    !format.pandoc.to?.includes("-citations") &&
    !format.render[kVariant]?.includes("-citations")
  ) {
    // citeproc: false is the default, so user setting it to true means they want to use
    // Pandoc's citeproc which requires `citations` extensions to be disabled (e.g typst-citations)
    // This adds the variants for them if not set already
    format.render[kVariant] = [format.render?.[kVariant], "-citations"].join(
      "",
    );
  }
}
