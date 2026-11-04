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

When updating Pandoc templates, read `dev-docs/update-pandoc-checklist.md` for the per-format file list, reference-copy maintenance, and filename checks.
