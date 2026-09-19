---
paths:
  - "src/core/sass*"
  - "src/format/html/format-html-scss*"
  - "src/format/html/format-html-axe*"
  - "src/format/reveal/format-reveal-theme*"
  - "src/format/dashboard/format-dashboard-shared*"
  - "src/resources/formats/**/*.scss"
  - "src/resources/projects/**/*.scss"
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

For the three-tier callout CSS architecture (Bootstrap, RevealJS, standalone HTML), see `llm-docs/callout-styling-html.md`.

## Focus indicators

Never author a focus ring. The browser's own ring adapts to the platform accent
color, to the user's accessibility settings, and to forced-colors mode, where
`box-shadow` is dropped entirely. An authored ring does none of that, and a
second convention next to the first is visible as an inconsistency when a user
tabs through a page.

So the only focus rules Quarto writes are ones that undo a vendor rule which
suppressed the browser ring:

```scss
// a bare .btn: Bootstrap's .btn:focus-visible sets outline: 0
.code-tools-button:focus-visible {
  outline: revert;
}
```

A bare `<button>` with no `.btn` class needs no rule at all — nothing suppressed
its ring. Bootstrap's reboot only clears the ring for `:focus:not(:focus-visible)`,
which is the mouse-click case.

When a control has no visible focus indicator, look for the suppression and
delete or revert it, rather than adding a ring of your own. See
`_bootstrap-rules.scss` for the one `outline: revert` rule, and quarto-cli#14774
and quarto-cli#12118 for the two times this came up.
