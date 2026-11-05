---
main_commit: c1800b927
analyzed_date: 2026-10-19
key_files:
  - src/resources/schema/cell-figure.yml
  - src/resources/rmd/hooks.R
  - src/core/jupyter/jupyter.ts
  - src/core/handlers/base.ts
  - src/core/handlers/mermaid.ts
  - src/core/handlers/dot.ts
  - src/core/svg.ts
  - src/resources/formats/html/mermaid/mermaid-init.js
  - src/resources/filters/common/figures.lua
  - src/resources/filters/quarto-pre/parsefiguredivs.lua
  - src/resources/filters/quarto-pre/figures.lua
  - src/resources/filters/layout/pandoc3_figure.lua
  - src/resources/filters/layout/hugo.lua
  - src/resources/filters/customnodes/floatreftarget.lua
  - src/resources/filters/quarto-post/html.lua
  - src/resources/filters/quarto-post/docx.lua
  - src/resources/filters/quarto-post/typst.lua
  - src/resources/filters/quarto-post/gfm.lua
  - src/resources/extensions/quarto/confluence/overrides.lua
---

# Alt Text (`fig-alt`) Architecture

How image alt text enters Quarto, travels through the engines and the Lua filter pipeline, and comes out in each output format. Read this before changing anything that touches `fig-alt`, image `alt`, figure captions on images, or diagram accessibility.

## The model

`fig-alt` is Quarto's one unambiguous alt-text channel. Pandoc 3 has no separate alt field on `Image`: the `![...]` inline content (`image.caption`) doubles as alt, and `{alt="..."}` replaces it. Inside a figure, `image.caption` is usually a copy of the visible caption, so Pandoc's writers would turn the caption into alt. Quarto keeps `fig-alt` as an attribute until a format-specific step writes it where that format expects alt. Quarto does not add a caption-as-alt fallback of its own; the exceptions where a Pandoc writer still derives alt from a caption are listed under [Policies](#policies).

The same text ends up in different places per format: `<img alt>`, `aria-label` on an inline SVG, a DOCX picture description, `\includegraphics[alt={...}]`, Typst `image(alt: ...)`, Confluence `ac:alt`.

## Entry points

### Markdown image attribute

`![caption](img.png){fig-alt="..."}`, with or without a `#fig-` label. An explicit empty value (`fig-alt=""`) survives here and on diagram cells; knitr and Jupyter drop it. The attribute is not in the YAML schema; the editor offers it as a completion in the `figure` context (`src/resources/editor/tools/attrs.yml`).

### Cell option

Schema in `src/resources/schema/cell-figure.yml`: `fig-alt` is `maybeArrayOf: string`, `formats: [$html-all, docx, $pdf-all, typst]`. A list means one alt per figure in a cell that produces several figures. The constant is `kCellFigAlt` in `src/config/constants.ts`.

### knitr

`src/resources/rmd/hooks.R`: `fig-alt` is normalized to `fig.alt` (`normalize_options`, the `knitr_options_dashed` list) and listed in `quarto_knitr_opts`, so it is not forwarded onto the `.cell` div. The plot hook emits it as an attribute on the image markdown: `![caption](path){... fig-alt='...'}`. The bracket text comes from `fig.cap`/`fig.subcap`, never from `fig.alt`.

- A list gives one alt per plot, in plot order.
- An empty string is dropped (`nzchar` check), so knitr cannot produce an explicitly empty alt.
- Animations (`fig.show: animate`) go through knitr's animation hooks, which do not emit `fig-alt`.

### Jupyter

`src/core/jupyter/jupyter.ts`: inside the per-output loop, `broadcastFigureOption("fig-alt")` returns `value[index]` for a list, else the scalar. `mdImageOutput` writes it as `fig-alt='...'` in the image's attribute block; the bracket text is the caption.

- `index` is the output's position among **all** cell outputs (streams, text, HTML included), not among figures. A cell that prints before plotting shifts the list: `print(...)` then two plots with `fig-alt: [A, B, C]` gives the plots `B` and `C`.
- A list shorter than the outputs leaves later figures without alt.
- An empty string is falsy and is dropped, like knitr.
- Only image outputs (`mdImageOutput`) use the figure options; HTML, LaTeX, and markdown outputs ignore `fig-alt`.

### Diagram cells (Mermaid, Graphviz)

`//| fig-alt:` / `%%| fig-alt:` on a `{dot}` or `{mermaid}` cell. Diagram handlers accept **only the string form**; a list is ignored without a warning (every read is guarded by `typeof alt === "string"`). A diagram cell is one figure, so a per-figure list has nothing to index. See [Diagrams](#diagrams).

`getDivAttributes` in `src/core/handlers/base.ts` keeps `fig-alt` off the cell div (`keysToNotSerialize`); each handler places it on the generated image itself.

### Other producers

Book cover images: `cover-image-alt` becomes `fig-alt` on the generated cover image markdown (`src/project/types/book/book-render.ts`). Unrelated `*-alt` options (`logo-alt`, `image-alt` for listings and social metadata) have their own paths and do not use `fig-alt`.

## Lua pipeline

Constant `kFigAlt = "fig-alt"` lives in `src/resources/filters/common/figures.lua`.

1. **Normalize: `parse_floatreftargets`** (`quarto-pre/parsefiguredivs.lua`). For a Pandoc `Figure` or a `#fig-` div, the image's attributes, `fig-alt` included, are copied onto the `FloatRefTarget`. The image keeps its own `fig-alt`, and its caption is cleared.
2. **Pre: `quarto_pre_figures`** (`quarto-pre/figures.lua`), `fig` floats only. For HTML output it sets `alt` on the float itself; this ends up as an `alt` attribute on the float's outer `<div>`, next to the correct `<img alt>`. For every other format it writes `alt` onto each `Image` in the float content (overwriting an explicit `alt`). Then it removes `fig-alt` from the float.
3. **Layout: `layout/pandoc3_figure.lua`** handles Pandoc `Figure`s that are not cross-ref floats (captioned image, no label).
   - LaTeX: figure attributes are copied onto the image and `fig-alt` becomes `alt` unless `alt` is already set. Pandoc's LaTeX writer then emits `\includegraphics[alt={...}]`.
   - Typst: `fig-alt` is copied from figure to image. With no `fig-alt`, an image whose caption equals the figure caption gets the `_quarto_no_caption_alt` marker (see Policies).
   - HTML: `htmlImageFigure`/`renderHtmlFigure` (`layout/html.lua`) clear the image caption and deliberately leave `fig-alt` for the post stage.
4. **FloatRefTarget renderers** (`customnodes/floatreftarget.lua`, plus `layout/hugo.lua` and `layout/confluence.lua`) build the per-format figure. They carry the image attributes through; the Typst renderer applies the same `_quarto_no_caption_alt` marker as `pandoc3_figure.lua`.
5. **Post fixups**, applied to every `Image`, plain or in a figure:
   - `render_html_fixups` (`quarto-post/html.lua`): `fig-alt` → `alt`.
   - `render_docx_fixups` (`quarto-post/docx.lua`): `fig-alt`, else `alt`, replaces `image.caption`, which the DOCX writer uses as the picture description (`descr`).
   - `render_typst_fixups` (`quarto-post/typst.lua`): `fig-alt` → `alt`, plus the empty-alt and no-caption-alt handling below.
6. **Confluence** (`extensions/quarto/confluence/overrides.lua`): the `publish.lua` custom writer calls `CaptionedImageConfluence`, which uses `fig-alt` for `ac:alt` (defaulting to the image title). A plain `alt` attribute is not read. `confluence-html` is the HTML preview format and follows the HTML path.

LaTeX, gfm, and hugo-md have no post-stage `fig-alt` conversion. That is why plain images lose alt in those formats (see [Known gaps](#known-gaps)).

## Diagrams

`src/core/handlers/mermaid.ts` and `dot.ts` turn the cell into one of several outputs. Each path places alt differently:

| Handler path | Chosen for | Where alt goes |
|---|---|---|
| Mermaid `makeJs` | default for JS-capable formats (`isJavascriptCompatible`: HTML formats, hugo-md) | `<pre class="mermaid" data-fig-alt>`; `mermaid-init.js` calls its `setSvgAlt` after Mermaid renders the SVG in the browser |
| Mermaid `makeSvg` | `mermaid-format: svg` | `setSvgAlt` on the inline SVG (`fixupMermaidSvg`); for non-JS formats, a `.svg` file linked with `fig-alt` |
| Mermaid `makePng` | default for non-JS formats and ipynb, or `mermaid-format: png` | `fig-alt` on the image link (`makeFigLink`), then the normal Lua path |
| Mermaid in gfm | default for `gfm` | raw ```` ``` mermaid ```` block, no alt |
| Graphviz inline SVG | JS-capable formats except ipynb | `setSvgAlt` on the inline SVG (`fixupSvg`) |
| Graphviz PNG | everything else | `fig-alt` on the image link (`makeFigLink`) |

`setSvgAlt` (`src/core/svg.ts`, mirrored in `mermaid-init.js`; keep the two in sync) sets `role="img"` and `aria-label`, and removes `aria-labelledby` so the label wins. An empty string removes `aria-label` and sets `aria-hidden="true"`. It writes no `<title>`. The visible caption stays separate.

## Policies

- **No caption-as-alt fallback.** A caption explains the figure's point; alt describes the image. Quarto removed the copies of caption into alt that PDF/UA work had introduced (#14107, PR #14142). For Typst, `_quarto_no_caption_alt` stops Pandoc's Typst writer from re-deriving alt from a figure image's caption: `render_typst_fixups` clears the caption of marked images. Inline images outside figures keep Pandoc's behaviour, where `![text]` is the alt. Exceptions where the caption still becomes alt:
  - DOCX: a captioned image without a label and without `fig-alt`/`alt` keeps Pandoc's default, with the caption as the picture description. A cross-ref figure without alt gets an empty description. `tests/docs/smoke-all/docx/figure-captions/markdown.qmd` asserts both.
  - gfm and hugo-md: see [Format status](#format-status).
- **DOCX writes alt for every image.** `fig-alt` becomes the picture description for plain images and figures alike (#5514, fixed by #15077).
- **Diagrams take a string only.** A list is meant for multi-figure cells; a diagram cell is one figure. A list `fig-cap` on a diagram renders as one joined caption, so a list `fig-alt` has no per-figure meaning to honour. This is intended behaviour, not a bug.
- **Explicit empty alt** (`fig-alt=""` on a markdown image or a diagram cell; knitr and Jupyter drop empty values). Rendered results for plain, captioned and cross-ref images, plus the diagram tests:
  - HTML: `alt=""` (decorative).
  - Inline SVG diagrams: `aria-hidden="true"`.
  - DOCX: empty description. Word's separate "decorative" flag is not set.
  - LaTeX: `alt={}` on figures; plain images get nothing, like any plain image.
  - Typst: no `alt:` at all, so the image is neither described nor marked decorative.

  Mapping an empty alt to a real "decorative" marker in DOCX and Typst is an open question.

## Format status

From renders with the dev build at `main_commit`. ✅ alt emitted, ❌ no alt, ⚠️ wrong: only `data-fig-alt`, or the caption used as alt. Plot columns read plain cell / cross-ref (`label: fig-` + `fig-cap`).

| Format | Plain image | Captioned, no label | Cross-ref figure | knitr plot | Jupyter plot | Mermaid | Graphviz |
|---|---|---|---|---|---|---|---|
| html | ✅ | ✅ | ✅ (+ stray div `alt`) | ✅ / ✅ | ✅ / ✅ | ✅ at runtime | ✅ `aria-label` |
| revealjs | ✅ | ✅ | ✅ | ✅ / ✅ | ✅ / ✅ | ✅ at runtime | ✅ `aria-label` |
| docx | ✅ `descr` | ✅ | ✅ | ✅ / ✅ | ✅ / ✅ | ✅ | ✅ |
| typst | ✅ | ✅ | ✅ | ✅ / ✅ | ✅ / ✅ | ✅ | ✅ |
| pdf / latex | ❌ | ✅ | ✅ | ❌ / ✅ | ❌ / ✅ | ❌ | ❌ |
| hugo-md | ⚠️ | ⚠️ caption | ⚠️ "Figure 1: caption" | ⚠️ / ⚠️ | ⚠️ / ⚠️ | ✅ at runtime | ✅ `aria-label` |
| gfm | ⚠️ | ⚠️ caption | ✅ | ⚠️ / ✅ | ⚠️ / ✅ | ❌ raw block | ⚠️ |
| markdown | `{fig-alt=...}` kept as written | same | same | same | same | same | same |
| confluence (publish) | ✅ `ac:alt` | ✅ | ✅ | ✅ / ✅ | ✅ / ✅ | ✅ | ✅ |

"At runtime" means the alt is set by `mermaid-init.js` in the browser (covered by the playwright test below), not present in the rendered HTML file.

## Known gaps

- LaTeX plain images and uncaptioned plots: #14315.
- LaTeX diagrams (Mermaid, Graphviz): #15087.
- hugo-md: #14344. Besides the missing post-stage conversion, the hugo float renderer (`layout/hugo.lua`) builds the image with the caption as its inline alt.
- gfm: same symptoms as hugo-md for plain images, captioned images, and engine plots; no GitHub issue yet.
- The cross-cutting tracking epic is #14348. Its summary predates #15077 and #14142; use the table above.

## Tests

- `tests/docs/smoke-all/pdf-standard/`: `typst-*alt*`, `typst-fig-alt-*`, `ua-image-alt-text.qmd`, `caption-not-alt-ua.qmd` (Typst and LaTeX alt, no-caption-fallback).
- `tests/docs/smoke-all/docx/figure-captions/`: DOCX description and caption for markdown, knitr, and Jupyter figures.
- `tests/docs/smoke-all/2026/10/15/diagram-fig-alt*.qmd`: diagram alt across formats, SVG mode, escaping.
- `tests/unit/core/svg-alt.test.ts`: `setSvgAlt`.
- `tests/integration/playwright/tests/diagram-fig-alt.spec.ts`: Mermaid runtime alt in the browser.

## Where to change what

| Task | Start in |
|---|---|
| New format needs alt | its `quarto-post/<format>.lua` `Image` fixup, following `render_docx_fixups` or `render_typst_fixups` |
| Alt on cross-ref figures | `quarto-pre/figures.lua`, then the format's FloatRefTarget renderer |
| Alt on captioned non-ref images | `layout/pandoc3_figure.lua` |
| Engine output (lists, escaping) | `hooks.R` plot hook / `jupyter.ts` `broadcastFigureOption` and `mdImageOutput` |
| Diagram alt | `makeFigLink`/`makeJs` in `mermaid.ts`, `dot.ts`, `setSvgAlt` in `svg.ts` + `mermaid-init.js` |
| Option docs / validation | `src/resources/schema/cell-figure.yml`, then `dev-call build-artifacts` |
