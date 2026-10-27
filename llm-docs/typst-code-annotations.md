---
main_commit: 405161424
analyzed_date: 2026-10-27
key_files:
  - src/format/typst/format-typst.ts
  - src/command/render/filters.ts
  - src/resources/filters/quarto-pre/code-annotation.lua
  - src/resources/filters/modules/typst-code-annotations.lua
  - src/resources/formats/typst/pandoc/quarto/definitions.typ
---

# Typst code annotations and filenames

This document describes how Quarto draws code annotations (the circled numbers) and filename bars in Typst output.
Read it before you change the Pandoc version, the line offsets, or the marker format.

## Pipeline

1. `quarto-pre/code-annotation.lua` finds `# <1>` comments in a code block, removes them, and records the line of each annotation.
2. The filter writes the result for the active highlighting mode (next section).
3. The ordered list that follows the code becomes one `#quarto-annotation-item(cell-id, n, [...])` call per item.
   The item's own blocks sit between a raw open and a raw close, so `crossref` and citations still run on them.
4. After Pandoc writes the `.typ` file, `src/format/typst/format-typst.ts` patches and merges the output.
5. `src/resources/formats/typst/pandoc/quarto/definitions.typ` holds the Typst helpers.

## Highlighting modes

The filter param `syntax-highlighting-mode` (set in `extractTypstFilterParams`) has three values.

- `skylighting`: Pandoc writes a generated `Skylighting()` function. The Lua filter emits a marker comment before the code block.
- `idiomatic`: Pandoc writes a native Typst `raw` block. The Lua filter wraps the block in `#quarto-code-annotation(annotations, cell-id: ...)[...]`.
- `none`: like `idiomatic`, with no language tag on the block.

## Marker protocol (`skylighting` mode)

The Lua filter writes `// quarto-code-annotations: <cell-id> ("<line>": <n>, ...)` as a raw Typst block.
The post-processor merges a marker into the next `#Skylighting(` call, which becomes `#Skylighting(cell-id: "...", annotations: (...), ...)`.
Only these wrappers may sit between the marker and the call: `#block[`, `#figure([`, and `#quarto-code-filename(...)[`.
A marker that does not merge is removed, and Quarto prints a warning with the cell id.

## Patches to Pandoc's `Skylighting()` function

`patchSkylightingFunction` changes the generated function with named patches: `signature`, `line counter`, `position counter` and `line rendering`.
The block styling and the brand background (`bgcolor` initialiser only) are applied first.
If one named patch does not apply, the function keeps only the block styling, annotations are off for the document, and Quarto prints a warning with the Pandoc version.
After a Pandoc update, run the `typst/code-annotations/` smoke-all documents and `tests/unit/typst-skylighting-patch.test.ts`.

## Line offsets

Two numbers shift the recorded lines, and they differ on purpose.

- `pendingStartFrom` is the display start from a `startFrom` attribute. Typst numbers the displayed lines.
- `pendingOffset` is the first source line. The generated function and `raw.line` both count source lines from 1.

`adjustAnnotations` converts the recorded lines to source lines with `lineNo - offset + 1`.
A fenced echo block (`{{python}}`) gets one extra line, because the filter writes the fence line the way `engine_escape` would, and the offset moves by one.

## Rendering helpers (`definitions.typ`)

- `quarto-circled-number` draws the circle. It sits inside a `math.equation` that carries the text alternative "Annotation N", because `box`, `text` and `link` do not accept `alt`. The circle sits in a zero-height box, so it overflows its row and adds no height. That box needs `baseline: 0.55em` with a `move(dy: -0.63em)`, which centres the circle on the cap height of the text. With the default baseline, a zero-height box still raises the top of its line by about 0.8pt, and the second annotated row ends up taller than a plain row.
- `quarto-annote-link` links only when the target label exists, so a missing list degrades to an unlinked circle.
- `quarto-code-annotation` is the native-mode renderer. The Skylighting patch contains its own per-line copy of the same layout. Change both together.
- With `.number-lines`, annotated rows use `width: 100% - annote-ln-width` so the circle stays on the code line.
- The default code fill is a `set block(fill: ...)` rule, so a brand or user `set block(fill: ...)` wins.

## Known limits

- An extension that replaces `definitions.typ` lacks the annotation helpers. The post-processor defines only the missing ones, before the first block that uses them.
- Code inside a figure with `layout-ncol` (`::: {#fig-a layout-ncol=2}` with a caption) cannot receive its circles, because the layout puts the marker in a grid cell of its own. Quarto prints a warning with the cell id and removes the marker. The list items still render, and the document compiles.
- `hover` and `select` annotation styles use the gutter style. `select` also prints a warning.
- Per-cell `code-annotations` options are not read for any format; only the document-level value counts.
- A filename longer than 60 characters may break at any character, using zero-width spaces.
- Two copies of the gutter layout exist (the Skylighting patch and `quarto-code-annotation`).

## Tests

`tests/docs/smoke-all/typst/code-annotations/`, `tests/docs/smoke-all/typst/code-filename/`, and `tests/unit/typst-skylighting-patch.test.ts`.
The knitr cell documents need a working R graphics device.
