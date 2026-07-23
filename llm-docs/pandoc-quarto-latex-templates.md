---
main_commit: d30cdbb9e
analyzed_date: 2026-07-23
key_files:
  - package/src/common/update-pandoc.ts
  - src/format/pdf/format-pdf.ts
  - src/resources/formats/pdf/pandoc/template.tex
  - src/resources/formats/pdf/pandoc/common.latex
  - src/resources/formats/pdf/pandoc/pandoc.tex
  - src/resources/formats/pdf/pandoc/document-metadata.latex
  - src/resources/formats/beamer/pandoc/template.tex
---

# Pandoc and Quarto LaTeX Templates

This document describes how Quarto integrates Pandoc's LaTeX templates and transforms them into a modular structure suitable for Quarto's extended functionality.

## 1. How Pandoc Templates Are Copied into Quarto

The `writePandocTemplates` function in `package/src/common/update-pandoc.ts` handles copying Pandoc's templates into Quarto's resources during the Pandoc update process.

### Source and Destination

- **Source**: Pandoc templates are downloaded from the Pandoc GitHub repository's `data/templates/` directory
- **Destination**: `src/resources/formats/pdf/pandoc/`

### Files Copied

**Stale-script warning**: `update-pandoc.ts`'s `templateDirFiles` mapping only lists `default.latex`, `common.latex`, `after-header-includes.latex`, `hypersetup.latex`, `font-settings.latex`, `fonts.latex`, and `passoptions.latex`. It does **not** include `document-metadata.latex` (added later, see below), so the script under-copies relative to what `format-pdf.ts` actually wires up. Don't trust the script's file list as the source of truth — cross-check against `partialNamesPandoc` in `format-pdf.ts` instead.

| Pandoc Source                 | Quarto Destination | Notes                                              |
| ----------------------------- | ------------------ | -------------------------------------------------- |
| `default.latex`               | `latex.template`   | Main Pandoc template                               |
| `common.latex`                | `latex.common`     | Reference copy (Quarto maintains modified version) |
| `after-header-includes.latex` | (unchanged)        | Post-header-includes processing                    |
| `hypersetup.latex`            | (unchanged)        | Hyperref configuration                             |
| `font-settings.latex`         | (unchanged)        | User font configuration                            |
| `fonts.latex`                 | (unchanged)        | Font engine detection                              |
| `passoptions.latex`           | (unchanged)        | Package options passthrough                        |
| `document-metadata.latex`     | (unchanged)        | PDF standard metadata (PDF/A, PDF/UA, PDF/X); added in Quarto 1.7 following Pandoc 3.6.3 support; **not copied by `update-pandoc.ts`'s current mapping** |

### Purpose of Each Pandoc File

**default.latex** (becomes `latex.template`): The main Pandoc LaTeX template. Quarto uses its own `template.tex` as the main orchestrator instead.

**common.latex** (becomes `latex.common`): Common preamble setup from Pandoc including paragraph formatting, verbatim settings, highlighting, tables, graphics, citations, and bibliography. Quarto keeps this as a reference copy.

**after-header-includes.latex**: Processing after user-provided header includes. Sets up xspace, bookmark, and URL packages.

**hypersetup.latex**: Hyperref configuration for PDF links, colors, and metadata.

**font-settings.latex**: User font configuration for different TeX engines (PDFTeX, XeTeX, LuaTeX). Handles mainfont, sansfont, monofont, mathfont, and CJK fonts.

**fonts.latex**: Font engine detection and setup. Loads fontspec for XeTeX/LuaTeX, handles font fallbacks.

**passoptions.latex**: Package options passthrough mechanism for hyperref, xcolor, and xeCJK.

**document-metadata.latex**: Emits a `\DocumentMetadata{...}` block (LuaLaTeX, 2023+ LaTeX) for PDF/A, PDF/UA, and PDF/X standards support, driven by the `pdfstandard` variable. Called first, before `passoptions.latex()`, in the pdf `template.tex`. **Beamer does not use this partial** — its `template.tex` has no `document-metadata.latex()` call, and `format-pdf.ts` filters it out of `beamerPartialNamesPandoc`.

## 2. Quarto's Modular Template Structure

Quarto breaks the Pandoc templates into a modular structure in `src/resources/formats/pdf/pandoc/`. This allows for:

- Better separation of concerns
- Easier customization and extension
- Support for Quarto-specific features (author normalization, bibliography control)

### File Extension Convention

Quarto uses file extensions to distinguish template origin:

- `.tex` files: Quarto-maintained partials
- `.latex` files: Pandoc-derived partials

### Template Files

The `pdfFormat` function in `src/format/pdf/format-pdf.ts` configures the template context, specifying `template.tex` as the main template with partials from both Quarto (`.tex`) and Pandoc (`.latex`).

### template.tex - The Orchestrator

Assembles the document by including all partials in order. This is Quarto's main template, distinct from Pandoc's `latex.template`.

### The "common" Files Architecture

Quarto maintains two versions of the common preamble:

**latex.common** (264 lines): Pandoc's original, kept as reference. Contains the full common preamble: paragraph formatting, verbatim, highlighting, tables, graphics, strikeout, CSL citations, Babel, page style, tight lists, subfigure support, text direction, natbib/biblatex configuration.

**common.latex** (66 lines): Quarto's shortened version that:

- Keeps Pandoc's paragraph formatting, verbatim, and listings setup
- Calls `$pandoc.tex()$` to delegate the rest to Quarto partials

This allows Quarto to selectively override specific parts of the common preamble while maintaining compatibility with Pandoc updates.

### Quarto Partials (\*.tex)

**Document Structure:**

| File               | Purpose                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `doc-class.tex`    | Document class declaration with babel languages, fontsize, papersize, and class options            |
| `before-title.tex` | Empty placeholder for pre-title content                                                            |
| `title.tex`        | Title, subtitle, author, and date setup. Uses Quarto's `authors` normalization (`it.name.literal`) |
| `before-body.tex`  | Frontmatter, `\maketitle`, and abstract rendering                                                  |
| `toc.tex`          | Table of contents, list of figures, list of tables                                                 |
| `after-body.tex`   | Empty placeholder for post-body content                                                            |

**Bibliography:**

| File                | Purpose                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `before-bib.tex`    | Empty placeholder before bibliography                                                                                                                   |
| `biblio.tex`        | Bibliography rendering with natbib or biblatex                                                                                                          |
| `biblio-config.tex` | Bibliography package configuration. Adds `$biblio-config$` conditional (Quarto-only variable) to allow class files to handle bibliography configuration |

**Content Elements (called via pandoc.tex):**

| File             | Purpose                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| `tables.tex`     | Table packages (longtable, booktabs, array, multirow) and footnote handling |
| `graphics.tex`   | graphicx package and `\pandocbounded` command for auto-scaling images       |
| `citations.tex`  | CSL citation definitions (`\citeproc`, `CSLReferences` environment)         |
| `babel-lang.tex` | Babel language configuration and font setup                                 |
| `tightlist.tex`  | `\tightlist` command for compact list spacing                               |

**Hub Partial:**

| File         | Purpose                                                                                                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pandoc.tex` | Hub that calls other Quarto partials. Contains highlighting, strikeout/underline, page style, subfigure support, text direction. Calls: `$tables.tex()$`, `$graphics.tex()$`, `$citations.tex()$`, `$babel-lang.tex()$`, `$tightlist.tex()$`, `$biblio-config.tex()$` |

## 3. Template Invocation Order

The `template.tex` orchestrates the full document:

### Preamble (before `\begin{document}`)

1. `$document-metadata.latex()$` - `\DocumentMetadata{...}` for PDF/A, PDF/UA, PDF/X (pdf only — beamer's `template.tex` omits this call)
2. `$passoptions.latex()$` - Package options passthrough
3. `$doc-class.tex()$` - `\documentclass[...]{...}` declaration
4. (inline) - beamerarticle, xcolor, geometry, amsmath
5. (inline) - Section numbering configuration
6. `$fonts.latex()$` - Font engine detection (ifPDFTeX, ifXeTeX, ifLuaTeX)
7. `$font-settings.latex()$` - User font configuration
8. `$common.latex()$` - Common preamble setup, which internally calls:
   - `$pandoc.tex()$` → `$tables.tex()$`, `$graphics.tex()$`, `$citations.tex()$`, `$babel-lang.tex()$`, `$tightlist.tex()$`, `$biblio-config.tex()$`
9. `$after-header-includes.latex()$` - Bookmark, URL packages
10. `$hypersetup.latex()$` - Hyperref configuration
11. `$before-title.tex()$` - Pre-title content
12. `$title.tex()$` - `\title{}`, `\author{}`, `\date{}`

### Document Body

13. `\begin{document}`
14. `$before-body.tex()$` - Frontmatter, `\maketitle`, abstract
15. (loop) - include-before content
16. `$toc.tex()$` - Table of contents
17. (inline) - linestretch, mainmatter
18. `$body$` - Document content
19. `$before-bib.tex()$` - Pre-bibliography content
20. (inline) - backmatter, nocite
21. `$biblio.tex()$` - Bibliography rendering
22. (loop) - include-after content
23. `$after-body.tex()$` - Post-body content
24. `\end{document}`

## 4. TypeScript Configuration

The template configuration is defined inline inside `src/format/pdf/format-pdf.ts` (around lines 241-267, in the function that builds the PDF format):

```typescript
// Quarto-maintained partials (.tex)
const partialNamesQuarto: string[] = [
  "babel-lang",
  "before-bib",
  "biblio",
  "biblio-config",
  "citations",
  "doc-class",
  "graphics",
  "after-body",
  "before-body",
  "pandoc",
  "tables",
  "tightlist",
  "before-title",
  "title",
  "toc",
];

// Pandoc-derived partials (.latex) — since Pandoc 3.6.3
const partialNamesPandoc: string[] = [
  "after-header-includes",
  "common",
  "document-metadata",
  "font-settings",
  "fonts",
  "hypersetup",
  "passoptions",
];
```

The template context maps these to files:

- Quarto partials: `pandoc/${name}.tex`
- Pandoc partials: `pandoc/${name}.latex`

Beamer builds its own `beamerPartialNamesPandoc` by filtering `document-metadata` out of `partialNamesPandoc` (`.filter((name) => name !== "document-metadata")`), since beamer's `template.tex` never calls it.

## 5. Parameter Summary Table

### Font Parameters (XeTeX/LuaTeX)

| Parameter          | Type   | Description                  |
| ------------------ | ------ | ---------------------------- |
| `mainfont`         | string | Main text font family        |
| `mainfontoptions`  | array  | Font options for main font   |
| `mainfontfallback` | array  | Fallback fonts for main font |
| `sansfont`         | string | Sans-serif font family       |
| `sansfontoptions`  | array  | Font options for sans font   |
| `sansfontfallback` | array  | Fallback fonts for sans font |
| `monofont`         | string | Monospace font family        |
| `monofontoptions`  | array  | Font options for mono font   |
| `monofontfallback` | array  | Fallback fonts for mono font |
| `mathfont`         | string | Math font family             |
| `mathfontoptions`  | array  | Font options for math font   |

### Font Parameters (PDFTeX)

| Parameter           | Type   | Description                            |
| ------------------- | ------ | -------------------------------------- |
| `fontfamily`        | string | Font package name (e.g., "libertinus") |
| `fontfamilyoptions` | array  | Options for font package               |
| `fontenc`           | string | Font encoding (default: "T1")          |

### CJK Font Parameters

| Parameter     | Type   | Description      |
| ------------- | ------ | ---------------- |
| `CJKmainfont` | string | CJK main font    |
| `CJKsansfont` | string | CJK sans font    |
| `CJKmonofont` | string | CJK mono font    |
| `CJKoptions`  | array  | CJK font options |

### Layout Parameters

| Parameter       | Type   | Description                                     |
| --------------- | ------ | ----------------------------------------------- |
| `documentclass` | string | Document class (default: "scrartcl" for Quarto) |
| `classoption`   | array  | Class options (e.g., "12pt", "twoside")         |
| `papersize`     | string | Paper size (e.g., "letter", "a4")               |
| `geometry`      | array  | Geometry package options                        |
| `linestretch`   | number | Line spacing multiplier                         |

### Section Parameters

| Parameter        | Type    | Description                   |
| ---------------- | ------- | ----------------------------- |
| `numbersections` | boolean | Enable section numbering      |
| `secnumdepth`    | integer | Depth of section numbering    |
| `fontsize`       | string  | Base font size (e.g., "11pt") |

### Color Parameters

| Parameter   | Type   | Description              |
| ----------- | ------ | ------------------------ |
| `linkcolor` | string | Color for internal links |
| `citecolor` | string | Color for citations      |
| `urlcolor`  | string | Color for URLs           |
| `toccolor`  | string | Color for TOC links      |

### Bibliography Parameters

| Parameter       | Type    | Description                                                     |
| --------------- | ------- | --------------------------------------------------------------- |
| `natbib`        | boolean | Use natbib for citations                                        |
| `biblatex`      | boolean | Use biblatex for citations                                      |
| `biblio-style`  | string  | Bibliography style                                              |
| `biblio-title`  | string  | Bibliography section title                                      |
| `bibliography`  | array   | Bibliography file paths                                         |
| `biblio-config` | boolean | Emit bibliography configuration (Quarto-only, defaults to true) |

### Quarto-Specific Parameters

| Parameter                | Quarto Name              | Description                                           |
| ------------------------ | ------------------------ | ----------------------------------------------------- |
| `number-sections`        | `numbersections`         | Enable section numbering                              |
| `shift-heading-level-by` | `shift-heading-level-by` | Auto-set to -1 when numbersections and no L1 headings |
| `toc`                    | `toc`                    | Include table of contents                             |
| `toc-depth`              | `toc-depth`              | TOC depth                                             |
| `toc-title`              | `toc-title`              | TOC heading                                           |
| `lof`                    | `lof`                    | Include list of figures                               |
| `lot`                    | `lot`                    | Include list of tables                                |

### Brand.yaml Integration

**Important**: Unlike HTML and Typst formats, LaTeX does NOT have automatic brand.yaml fallback for typography. Font and color settings must be specified explicitly via Pandoc metadata variables:

```yaml
format:
  pdf:
    mainfont: "Inter"
    sansfont: "Outfit"
    monofont: "Fira Code"
    fontsize: 11pt
```
