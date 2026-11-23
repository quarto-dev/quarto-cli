---
main_commit: 46e617020
analyzed_date: 2026-11-22
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
- `quarto-circled-number` resets the `set block` rule before it draws the circle. A template or an extension can wrap code blocks in a broad `set block` rule, for example with `width: 100%` and an inset. Without the reset, that rule reaches the blocks inside the circle, and the circle drops off its code line onto a new line.
- `quarto-code-annotation` draws its circles inside the raw block, where the text is smaller (0.8em). It reads `text.size` outside the block and gives it to `quarto-circled-number` as `size`, so all circles have the same size as the circles of the annotation list.
- `quarto-annote-link` links only when the target label exists, so a missing list degrades to an unlinked circle.
- `quarto-code-annotation` is the native-mode renderer. The Skylighting patch contains its own per-line copy of the same layout. Change both together.
- With `.number-lines`, annotated rows use `width: 100% - annote-ln-width` so the circle stays on the code line.
- The default code fill is a `set block(fill: ...)` rule, so a brand or user `set block(fill: ...)` wins.
- `quarto-code-block` draws every code block, from the patched `Skylighting` function and from the native raw block rule.
- `quarto-code-filename` draws the frame and the filename bar. The code block inside the frame draws no outline and no radius, so the frame shows one border.
- Typst closures see only the bindings above them. The style helpers come first in the file, `quarto-color-is-dark` comes before `quarto-code-block-style-resolve`, and `quarto-annote-color` comes before `quarto-circled-number`.

## Code block style (`quarto-code-block-style`)

The `quarto-code-block-style` state holds the style of code blocks and of the filename bar.
A template or a filter changes it with `quarto-code-block-style.update(s => s + (key: value))`.
The key names match the `code-window-theme` state of the quarto-code-window extension, where the two overlap.

| Key | Default | Effect |
| --- | --- | --- |
| `inset` | `8pt` | Inset of the code block. |
| `radius` | `2pt` | Radius of the code block and of the filename frame. |
| `stroke` | `auto` | Outline of the code block and of the filename frame. `auto` gives `0.5pt + luma(128)` against a light background and `0.5pt + luma(100)` against a dark one. Any Typst stroke value is accepted, also a dictionary with one value for each side. |
| `fill` | `auto` | Background of the code block. |
| `surface` | `auto` | Background of the filename bar. `auto` gives `luma(220)` against a light background and `luma(55)` against a dark one. |
| `label` | `auto` | Colour of the filename text. `auto` gives `luma(30)` against a light background and `luma(225)` against a dark one. |
| `title-inset` | `(x: 8pt, y: 4pt)` | Inset of the filename bar. |

The fill of a code block comes from the first of these that is not `auto`:

1. The `fill` key of the state. A colour or `none` (no background) also removes the set rule fill of the raw block inside.
2. The `fill` argument of `quarto-code-block`. The patched `Skylighting` function gives `bgcolor`, which is the highlight style background or the brand `monospace-block.background-color`.
3. The `set block(fill: ...)` rules. For native code blocks, the default rule gives `luma(230)`.

`quarto-code-block-style-resolve` merges the state on `quarto-code-block-style-defaults`.
It then replaces an `auto` stroke, surface or label with the colour for a background.
That background is the `bg` argument when it is a colour, and `page.fill` otherwise.
A background is dark when its BT.709 relative luminance is under 0.5, the same test as `quarto-annote-color` (`quarto-color-is-dark`).
The page fill is read in context, so the resolve function must be called in context.

`quarto-code-block` gives its drawn fill as `bg`: the style fill, else the fill argument, else the `block.fill` of the set rules.
It also puts that fill in a `<quarto-code-fill>` metadata before the block.
`quarto-code-filename` puts a `<quarto-code-filename-end>` metadata after its body.
It queries the first `<quarto-code-fill>` between its own position and that end marker, and gives it as `bg`, so the bar, label and frame match the code block that they frame.
A code block with no fill, or a frame with no code block, falls back to the page fill.
Thus a state that replaces the full dictionary keeps the defaults for the keys that it does not set.
An unknown key stops the compile with `quarto-code-block-style: unknown key "<key>". Known keys: ...`.

On the Skylighting path, `quarto-circled-number` gets `bg: bgcolor`.
The circle colour contrasts with the `fill` key when it is set, and with `bgcolor` when it is not.
On the native path, the circles follow the colour of the code text.
A template that sets a dark `fill` must also set a light code text colour, for example with `show raw.where(block: true): set text(fill: ...)`. The circles then follow that colour.

## Known limits

- An extension that replaces `definitions.typ` lacks the annotation helpers. The post-processor defines only the missing ones, before the first block that uses them.
- Code inside a figure with `layout-ncol` (`::: {#fig-a layout-ncol=2}` with a caption) cannot receive its circles, because the layout puts the marker in a grid cell of its own. Quarto prints a warning with the cell id and removes the marker. The list items still render, and the document compiles.
- `hover` and `select` annotation styles use the gutter style. `select` also prints a warning.
- Per-cell `code-annotations` options are not read for any format; only the document-level value counts.
- A filename longer than 40 characters may break after `/`, `_`, `.` and `-`, using zero-width spaces, and a run of more than 30 characters without those may break at any character. The last `.` keeps the extension attached.
- Two copies of the gutter layout exist (the Skylighting patch and `quarto-code-annotation`).

## Tests

`tests/docs/smoke-all/typst/code-annotations/`, `tests/docs/smoke-all/typst/code-filename/`, `tests/docs/smoke-all/typst/code-block-style/`, and `tests/unit/typst-skylighting-patch.test.ts`.
The `code-block-style/` documents update the state in a raw Typst block, then count the drawn elements with `show` rules and `assert`. A wrong count stops the compile.
The knitr cell documents need a working R graphics device.
