# Pandoc and Quarto Typst Templates

This document describes how Quarto integrates Pandoc's typst templates and transforms them into a more modular structure suitable for Quarto's extended functionality.

## 1. How Pandoc Templates Are Copied into Quarto

The `writePandocTemplates` function in `package/src/common/update-pandoc.ts` handles copying Pandoc's templates into Quarto's resources during the Pandoc update process.

### Source and Destination

- **Source**: Pandoc templates are downloaded from the Pandoc GitHub repository's `data/templates/` directory
- **Destination**: `src/resources/formats/typst/pandoc/`

### Files Copied

Two files are copied from Pandoc for typst support:

| Pandoc Source | Quarto Destination |
|---------------|-------------------|
| `default.typst` | `typst.template` |
| `template.typst` | `template.typst` (unchanged name) |

### Purpose of Each Pandoc File

**default.typst** (becomes `typst.template`): The main Pandoc template that orchestrates the document structure. It:
- Defines a horizontal rule helper
- Sets up term list rendering with indented descriptions
- Configures table styling with no strokes
- Sets figure caption positions for tables (top) and images (bottom)
- Optionally includes syntax highlighting definitions
- Either imports a user-provided template or inlines the `template.typst` content via `$template.typst()$`
- Disables smart quotes if not enabled
- Processes header-includes
- Invokes the `conf()` function with all document metadata
- Renders include-before content, TOC, body, bibliography, and include-after content

**template.typst**: Defines the `conf()` document function and helpers. It:
- Provides a `content-to-string` helper to extract text from content nodes
- Defines `conf()` which accepts all document metadata parameters
- Sets document metadata (title, keywords, author) for PDF accessibility
- Configures page, paragraph, text, and heading settings
- Applies link, reference, and file colors
- Renders the title block with optional thanks footnote
- Returns the document content

## 2. Quarto's Modular Template Structure

Quarto breaks the Pandoc templates into a modular structure in `src/resources/formats/typst/pandoc/quarto/`. This allows for:
- Better separation of concerns
- Easier customization and extension
- Support for Quarto-specific features (brand typography, callouts, subfloats)

### Template Files

The `typstFormat` function in `src/format/typst/format-typst.ts` configures the template context, specifying `template.typ` as the main template with these partials: `definitions.typ`, `typst-template.typ`, `page.typ`, `typst-show.typ`, `notes.typ`, and `biblio.typ`.

### template.typ - The Orchestrator

Assembles the document by including all partials in order:
1. `definitions.typ()` - utility definitions
2. `typst-template.typ()` - the article function
3. Header-includes loop
4. `page.typ()` - page configuration
5. `typst-show.typ()` - applies the article function
6. Include-before loop
7. Body
8. `notes.typ()` - endnotes handling
9. `biblio.typ()` - bibliography
10. Include-after loop

### definitions.typ - Utility Definitions

Combines Pandoc definitions with Quarto-specific functionality:

**From Pandoc**:
- `content-to-string` helper to extract text from content nodes (used for PDF metadata and link colors)
- `horizontalrule` definition for horizontal rules
- Term list show rule with indented descriptions
- Code highlighting definitions (conditionally included)

**Quarto additions**:
- `endnote` helper for endnote rendering
- Code block styling (gray background, padding, rounded corners)
- `block_with_new_content` helper for reconstructing blocks with modified content
- `empty` function to check if content is empty (handles strings and content nodes)
- Subfloat support via `quartosubfloatcounter` and `quarto_super` function for nested figures with sub-numbering
- Callout figure show rule that transforms callout figures with proper titles and cross-reference numbering
- `callout` function for rendering callout boxes with customizable colors, icons, and styling

### typst-template.typ - The Article Function

Corresponds to `conf()` in Pandoc's `template.typst`. Defines the `article()` function with these parameters:

**Document Metadata** (from Pandoc):
- `title`, `subtitle`, `authors`, `keywords`, `date`
- `abstract-title`, `abstract`, `thanks`

**Layout** (from Pandoc):
- `cols`, `lang`, `region`

**Typography** (from Pandoc):
- `font`, `fontsize`, `mathfont`, `codefont`, `linestretch`, `sectionnumbering`
- `linkcolor`, `citecolor`, `filecolor`

**Quarto Extensions**:
- `title-size`, `subtitle-size` for customizable title sizing
- `heading-family`, `heading-weight`, `heading-style`, `heading-color`, `heading-line-height` for brand typography
- `toc`, `toc_title`, `toc_depth`, `toc_indent` for integrated table of contents

**Functionality**:
- Sets `document()` metadata (title, keywords, author string) for PDF accessibility
- Configures paragraph justification and leading from `linestretch`
- Applies conditional font settings using `set ... if` pattern (Typst 0.14+)
- Applies link colors using `content-to-string` helper
- Renders the title block with thanks footnote, author grid, date, and abstract
- Optionally renders table of contents
- Handles single or multi-column layout

### page.typ - Page Configuration

Extracted from Pandoc's `conf()` function to allow independent page setup:
- Sets paper size (defaults to "us-letter")
- Sets margins (defaults to x: 1.25in, y: 1.25in)
- Sets page numbering
- Sets column count
- Optionally sets a background logo image with configurable location, inset, width, and alt text (Quarto extension)

### typst-show.typ - Parameter Mapping

Applies the `article()` function via a show rule, mapping Pandoc metadata and brand.yaml values to parameters. Follows precedence rules where Pandoc metadata takes priority and brand.yaml provides fallbacks.

**Pandoc Metadata Mappings**:
- `title`, `subtitle`, `date`, `abstract` → direct pass-through
- `by-author` → `authors` (uses Quarto's author normalization with `it.name.literal` and `it.affiliations`)
- `labels.abstract` → `abstract-title` (localized)
- `mainfont` → `font`
- `fontsize` → `fontsize`
- `mathfont` → `mathfont`
- `codefont` → `codefont`
- `linestretch` → `linestretch`
- `section-numbering` → `sectionnumbering`
- `thanks` → `thanks`
- `linkcolor`, `citecolor`, `filecolor` → link color parameters
- `keywords` → `keywords`
- `toc`, `toc-title`, `toc-depth`, `toc-indent` → TOC parameters
- `columns` → `cols`

**Brand.yaml Fallbacks** (used when Pandoc metadata not set):
- `brand.typography.base.family` → `font`
- `brand.typography.base.size` → `fontsize`
- `brand.typography.monospace.family` → `codefont`
- `brand.typography.headings.family` → `heading-family`
- `brand.typography.headings.weight` → `heading-weight`
- `brand.typography.headings.style` → `heading-style`
- `brand.typography.headings.color` → `heading-color`
- `brand.typography.headings.line-height` → `heading-line-height`

### notes.typ - Endnotes Section

Renders endnotes when present:
- Adds vertical space and a horizontal rule
- Sets smaller text size (0.88em)
- Renders the notes content

### biblio.typ - Bibliography

Handles bibliography rendering:
- Sets bibliography style from CSL file or bibliography style option
- Renders bibliography from specified files

### typst.template - Reference Copy

This is the copy of Pandoc's `default.typst`, kept for reference. It is used when rendering without Quarto's template context (e.g., when a user provides a custom template).

## 3. Parameter Summary Table

| Pandoc Parameter | Quarto Parameter | Brand.yaml Fallback | Notes |
|-----------------|------------------|---------------------|-------|
| `title` | `title` | - | |
| `subtitle` | `subtitle` | - | |
| `author` | `authors` | - | Normalized via `by-author` |
| `keywords` | `keywords` | - | Array of quoted strings |
| `date` | `date` | - | |
| `abstract` | `abstract` | - | |
| `abstract-title` | `abstract-title` | `labels.abstract` | Localized |
| `thanks` | `thanks` | - | Title footnote |
| `mainfont` | `font` | `brand.typography.base.family` | |
| `fontsize` | `fontsize` | `brand.typography.base.size` | |
| `mathfont` | `mathfont` | - | |
| `codefont` | `codefont` | `brand.typography.monospace.family` | |
| `linestretch` | `linestretch` | - | Multiplied by 0.65em for leading |
| `section-numbering` | `sectionnumbering` | - | |
| `linkcolor` | `linkcolor` | - | Hex color string |
| `citecolor` | `citecolor` | - | Hex color string |
| `filecolor` | `filecolor` | - | Hex color string |
| `columns` | `cols` | - | |
| `papersize` | (in page.typ) | - | |
| `margin` | (in page.typ) | - | |
| `page-numbering` | (in page.typ) | - | |
| - | `title-size` | - | Quarto extension |
| - | `subtitle-size` | - | Quarto extension |
| - | `heading-family` | `brand.typography.headings.family` | Quarto extension |
| - | `heading-weight` | `brand.typography.headings.weight` | Quarto extension |
| - | `heading-style` | `brand.typography.headings.style` | Quarto extension |
| - | `heading-color` | `brand.typography.headings.color` | Quarto extension |
| - | `heading-line-height` | `brand.typography.headings.line-height` | Quarto extension |
| `toc` | `toc` | - | |
| `toc-title` | `toc_title` | - | |
| `toc-depth` | `toc_depth` | - | |
| `toc-indent` | `toc_indent` | - | Quarto extension |
