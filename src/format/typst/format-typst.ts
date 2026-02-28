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
function skylightingPostProcessor(brandBgColor?: string) {
  // Match the entire #let Skylighting(...) = { ... } function.
  // The signature is stable and generated by Skylighting's Typst backend.
  const skylightingFnRe =
    /(#let Skylighting\(fill: none, number: false, start: 1, sourcelines\) = \{[\s\S]*?\n\})/;

  return async (output: string) => {
    const content = Deno.readTextFileSync(output);

    const match = skylightingFnRe.exec(content);
    if (!match) {
      // No Skylighting function found — document may not have code blocks,
      // or upstream changed the function signature. Nothing to patch.
      return;
    }

    let fn = match[1];

    // Fix block() call: add width, inset, radius
    fn = fn.replace(
      "block(fill: bgcolor, blocks)",
      "block(fill: bgcolor, width: 100%, inset: 8pt, radius: 2pt, blocks)",
    );

    // Override bgcolor with brand monospace-block background-color
    if (brandBgColor) {
      fn = fn.replace(
        /let bgcolor = rgb\("[^"]*"\)/,
        `let bgcolor = rgb("${brandBgColor}")`,
      );
    }

    if (fn !== match[1]) {
      Deno.writeTextFileSync(output, content.replace(match[1], fn));
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
