---
paths:
  - "src/resources/formats/pdf/pandoc/**"
  - "src/resources/formats/beamer/pandoc/**"
  - "src/resources/formats/typst/pandoc/**"
  - "src/resources/formats/html/pandoc/**"
  - "src/resources/formats/revealjs/pandoc/**"
  - "src/resources/formats/asciidoc/pandoc/**"
  - "package/src/common/update-pandoc.ts"
  - "dev-docs/update-pandoc-checklist.md"
---

# Pandoc Templates (LaTeX, Typst, HTML, Reveal.js, AsciiDoc)

For how Pandoc's LaTeX templates are copied into Quarto and restructured into a modular form (`latex.template`, `latex.common`, …), see `llm-docs/pandoc-quarto-latex-templates.md`.

For the equivalent Typst template integration (`typst.template`, `template.typst`), see `llm-docs/pandoc-quarto-typst-templates.md`.

Every format's `pandoc/` directory has the same split: a dev-reference-only copy of Pandoc's own template (unreferenced by any TypeScript code — kept only so a maintainer can diff it against a fresh Pandoc checkout) alongside Quarto's actual, wired-up template. `dev-docs/update-pandoc-checklist.md` has the full per-format file list (pdf, beamer, html, revealjs, asciidoc, typst) and the naming gotcha that makes the reference-copy file easy to miss when checking what's in a directory.
