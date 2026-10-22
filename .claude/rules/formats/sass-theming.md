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

## Keyboard focus ring (Bootstrap formats)

One rule in `_bootstrap-rules.scss` draws the focus ring for every focusable
element: `:root :focus-visible`. The `focus-ring` mixin in
`_bootstrap-mixins.scss` defines the ring. Do not add focus rules for one
control. A rule with a higher specificity replaces part of the ring on that
control.

- One exception is the search box. Its visible field is `.aa-Form`, which
  holds a borderless `.aa-Input`. The form gets `@include focus-ring` when the
  input has focus, and the input gets no ring.
- Another exception is pagination. Some Bootswatch themes (vapor, zephyr)
  give `.page-link` a `box-shadow` with a higher specificity, so a
  `(0,4,0)` rule includes the ring again.

- The ring follows W3C technique C40. The outer color is a 2px `outline`. The
  inner color is a `box-shadow` that fills the 2px `outline-offset`.
- On a dark page (`$body-bg` has more contrast with white than with black),
  the derived tones swap: white goes on the `outline`. The test is per
  stylesheet, not per `light:`/`dark:` key. If a user sets
  `$focus-ring-outer-color` or `$focus-ring-inner-color`, nothing swaps.
- The outer color is the `outline` because Bootswatch themes often set
  `box-shadow` on controls, but rarely `outline`. Forced-colors mode also
  keeps the `outline`.
- `_bootstrap-variables.scss` sets Bootstrap's focus halos to `none`. Do not
  turn them on again.
- If an element must not show the ring, set both `outline: none` and
  `box-shadow: none`. An example is `#quarto-document-content`, which gets
  focus from the skip link.
- If a scroll container clips the ring, add `$focus-ring-extent` of padding
  on that side. The TOC sidebars and the collapsed navbar menu are examples.
