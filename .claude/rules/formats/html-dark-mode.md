---
paths:
  - "src/format/html/format-html-info*"
  - "src/format/html/format-html-bootstrap*"
  - "src/command/render/pandoc-html*"
  - "src/resources/formats/html/templates/quarto-html-*body.ejs"
  - "src/core/brand/**"
  - "src/command/dev-call/axe/**"
---

# HTML Dark Mode

`formatDarkMode(format)` (`src/format/html/format-html-info.ts`) is the single
predicate for "does this page have a dark mode" — `undefined` means no.
The `data-mode` link attribute measures compiled CSS darkness; it does not
declare the author's slot. The dark slot's stable identity is the
`quarto-color-alternate` class.

For the full picture — configuration surface (`theme`, `brand`/`_brand.yml`),
rendered DOM markers, programmatic mode switching, and the known traps
(light-only brand, light-colored dark slots, `theme: darkly`) — see
`llm-docs/html-dark-mode-architecture.md`.
