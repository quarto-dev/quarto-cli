---
paths:
  - "src/core/sass*"
  - "src/format/html/format-html-scss*"
  - "src/format/html/format-html-axe*"
  - "src/format/reveal/format-reveal-theme*"
  - "src/format/dashboard/format-dashboard-shared*"
  - "src/resources/formats/**/*.scss"
---

# Sass Theming

RevealJS sass-bundles compile separately from the theme (`format-reveal-theme.ts`),
so theme variables aren't in scope. Use CSS custom properties from `exposer.scss`:
`--r-background-color`, `--r-main-color`, `--r-heading-color`, etc.

For cross-format CSS (works in both Bootstrap and RevealJS):
```scss
background-color: var(--r-background-color, $body-bg);
```

Read `llm-docs/sass-theming-architecture.md` for full compilation pipeline details.
