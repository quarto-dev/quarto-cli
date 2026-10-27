/*
 * format-typst.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "../../deno_ral/path.ts";
import { warning } from "../../deno_ral/log.ts";
import { execProcess } from "../../core/process.ts";

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
import { formatResourcePath, pandocBinaryPath } from "../../core/resources.ts";
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

const annotatedLineRendering =
  `let annote-num = annotations.at(str(annote-pos), default: none)
     if annote-num != none {
       if cell-id != "" {
         let lbl = cell-id + "-annote-" + str(annote-num)
         if str(annote-num) not in seen-annotes {
           seen-annotes.insert(str(annote-num), true)
           blocks = blocks + box(width: 100% - annote-ln-width)[#ln #h(1fr) #quarto-annote-link(lbl)[#quarto-circled-number(annote-num, color: quarto-annote-color(bgcolor))] #label(lbl + "-back")] + EndLine()
         } else {
           blocks = blocks + box(width: 100% - annote-ln-width)[#ln #h(1fr) #quarto-annote-link(lbl)[#quarto-circled-number(annote-num, color: quarto-annote-color(bgcolor))]] + EndLine()
         }
       } else {
         blocks = blocks + box(width: 100% - annote-ln-width)[#ln #h(1fr) #quarto-circled-number(annote-num, color: quarto-annote-color(bgcolor))] + EndLine()
       }
     } else {
       blocks = blocks + ln + EndLine()
     }`;

export function applyPatch(
  source: string,
  pattern: string | RegExp,
  replacement: string,
): { source: string; applied: boolean } {
  const patched = source.replace(pattern, replacement);
  return { source: patched, applied: patched !== source };
}

// Styles Pandoc's Skylighting function, then adds the annotation patches.
// When one annotation patch misses, the styled function without any
// annotation patch is returned together with the name of the missed patch.
export function patchSkylightingFunction(
  fn: string,
  brandBgColor?: string,
): { fn: string; failedPatch?: string } {
  // Fix block() call: add width, inset, radius, stroke
  let styled = fn.replace(
    "block(fill: bgcolor, blocks)",
    "block(fill: bgcolor, width: 100%, inset: 8pt, radius: 2pt, stroke: 0.5pt + luma(200), blocks)",
  );

  // Override bgcolor with brand monospace-block background-color
  if (brandBgColor) {
    styled = styled.replace(
      /(let bgcolor = )(?:rgb\("[^"]*"\)|none)/,
      `$1rgb("${brandBgColor}")`,
    );
  }

  const patches: [string, string | RegExp, string][] = [
    [
      "signature",
      "start: 1, sourcelines)",
      'start: 1, cell-id: "", annotations: (:), sourcelines)',
    ],
    // Move lnum increment outside if-number block and track a 1-based
    // annotation position independent of `start` (annotation dict keys
    // are always 1-based, whether or not Pandoc passes `start:`)
    [
      "line counter",
      /if number \{\n\s+lnum = lnum \+ 1\n/,
      "lnum = lnum + 1\n     annote-pos = annote-pos + 1\n     if number {\n",
    ],
    // Initialise the annotation position counter and a dictionary to
    // track which annotation numbers have already emitted a back-label
    // (avoids duplicate labels when one annotation spans multiple lines).
    [
      "position counter",
      /let lnum = start - 1\n/,
      "let lnum = start - 1\n     let annote-pos = 0\n     let seen-annotes = (:)\n     let annote-ln-width = if number { if start + sourcelines.len() > 999 { 30pt } else { 24pt } } else { 0pt }\n",
    ],
    // Add annotation rendering per line (derive circle colour from bgcolor).
    // quarto-annote-link degrades to an unlinked circle when the annotation
    // item label is missing (e.g. no trailing ordered list).
    [
      "line rendering",
      "blocks = blocks + ln + EndLine()",
      annotatedLineRendering,
    ],
  ];

  let annotated = styled;
  for (const [name, pattern, replacement] of patches) {
    const result = applyPatch(annotated, pattern, replacement);
    if (!result.applied) {
      return { fn: styled, failedPatch: name };
    }
    annotated = result.source;
  }
  return { fn: annotated };
}

async function pandocVersion(): Promise<string> {
  const result = await execProcess({
    cmd: pandocBinaryPath(),
    args: ["--version"],
    stdout: "piped",
  });
  return result.stdout?.split("\n")[0]?.split(" ")[1] ?? "(unknown version)";
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
// replace target won't match). The brand color regex targets the bgcolor
// initialiser only, so line-number colours are left alone.
function skylightingPostProcessor(brandBgColor?: string) {
  // Match the entire #let Skylighting(...) = { ... } function.
  // The signature is stable and generated by Skylighting's Typst backend.
  const skylightingFnRe =
    /(#let Skylighting\(fill: none, number: false, start: 1, sourcelines\) = \{[\s\S]*?\n\})/;

  // Annotation markers emitted by the Lua filter as Typst comments.
  // Between the marker and the Skylighting call there may be #block[ (cell
  // divs), #figure([ (crossref floats), and #quarto-code-filename( wrappers.
  const annotationMarkerRe =
    /\/\/ quarto-code-annotations: ([^\n]*?) (\([^)]*\))\n(\s*(?:(?:#block\[|#figure\(\[)\s*)*(?:#quarto-code-filename\([^\n]*\)\[\s*)?)#Skylighting\(/g;

  return async (output: string) => {
    const original = Deno.readTextFileSync(output);
    let content = original.replace(/\r\n/g, "\n");
    let changed = content !== original;

    let annotationsPatched = true;
    const match = skylightingFnRe.exec(content);
    if (match) {
      const patched = patchSkylightingFunction(match[1], brandBgColor);
      if (patched.failedPatch !== undefined) {
        annotationsPatched = false;
        warning(
          `Typst code annotations: patch "${patched.failedPatch}" did not apply to Pandoc ${await pandocVersion()}; annotations are disabled for this document.`,
        );
      }
      if (patched.fn !== match[1]) {
        content = content.replace(match[1], patched.fn);
        changed = true;
      }
    }

    // Merge annotation markers into Skylighting call sites, including
    // optional #block[ wrappers and #quarto-code-filename(...)[ wrappers.
    if (annotationsPatched) {
      const merged = content.replace(
        annotationMarkerRe,
        '$3#Skylighting(cell-id: "$1", annotations: $2, ',
      );
      if (merged !== content) {
        content = merged;
        changed = true;
      }
    }

    // Strip markers that could not be merged (e.g. the code block was
    // wrapped in output the merge regex does not recognise) so they don't
    // leak into keep-typ output. Rendering degrades gracefully via
    // quarto-annote-link.
    const stripped = content.replace(
      /^[^\S\n]*\/\/ quarto-code-annotations: ([^\n]*?) \([^\n]*\n/gm,
      (_marker, cellId: string) => {
        if (annotationsPatched) {
          warning(
            `Typst code annotations: the annotations of cell "${cellId}" could not be attached to its code block and are not shown in the code.`,
          );
        }
        return "";
      },
    );
    if (stripped !== content) {
      content = stripped;
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
