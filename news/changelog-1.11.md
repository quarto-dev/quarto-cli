All changes included in 1.11:

## Regression fixes

- ([#14741](https://github.com/quarto-dev/quarto-cli/issues/14741)): Don't wrap the `longtable` environment of a cross-referenceable table in a `{ ... }` group. Pandoc emits that group to scope its `\def\LTcaptype{none}`, which Quarto removes when adding its own `\caption`; keeping the now-pointless group broke packages that move the environment out of the text flow, such as `endfloat` with `\DeclareDelayedFloatFlavor*{longtable}{table}`.

## Accessibility

- ([#13463](https://github.com/quarto-dev/quarto-cli/issues/13463)): The dark/light mode toggle is now a switch (`button` with `role="switch"`, `aria-checked`, and a localized `aria-label`) instead of a nameless link, in all three places it is created: website navbars/sidebars, plain documents with a light/dark theme pair, and multi-page dashboards. Screen readers now announce the control's name, role, and which mode is active, and Space activates it as well as Enter. Custom CSS targeting `a.quarto-color-scheme-toggle` should now target the `button` element instead.
- ([#14615](https://github.com/quarto-dev/quarto-cli/issues/14615)): Fix invalid `role="menu"` on the website navbar's collapse toggle button, flagged by axe-core (`aria-allowed-role`) and WAVE (`aria_menu_broken`) when the navbar collapses to the hamburger at narrow viewports.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.

## Other fixes and improvements

- [#14735](https://github.com/quarto-dev/quarto-cli/issues/14735) Fix a crash when the `QUARTO_R` environment variable is set to a malformed path. Quarto now warns and falls back to other R lookup strategies instead of aborting the render. ([posit-dev/positron#15614](https://github.com/posit-dev/positron/discussions/15614))
