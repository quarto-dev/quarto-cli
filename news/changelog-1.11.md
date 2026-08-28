All changes included in 1.11:

## Regression fixes

- ([#14741](https://github.com/quarto-dev/quarto-cli/issues/14741)): Don't wrap the `longtable` environment of a cross-referenceable table in a `{ ... }` group. Pandoc emits that group to scope its `\def\LTcaptype{none}`, which Quarto removes when adding its own `\caption`; keeping the now-pointless group broke packages that move the environment out of the text flow, such as `endfloat` with `\DeclareDelayedFloatFlavor*{longtable}{table}`.

## Accessibility

- ([#14378](https://github.com/quarto-dev/quarto-cli/issues/14378)): Make scrollable code blocks and cell output keyboard-focusable in HTML output, so keyboard users can Tab to them and scroll with the arrow keys (axe rule `scrollable-region-focusable`, WCAG 2.1.1). While a region overflows it gets `tabindex="0"`, `role="group"`, and a localized `aria-label` (new `scrollable-code-label` and `scrollable-output-label` language keys); when it fits again the attributes are removed. Chrome and Firefox already focus such regions natively; this adds Safari coverage and an accessible name.
- ([#14615](https://github.com/quarto-dev/quarto-cli/issues/14615)): Fix invalid `role="menu"` on the website navbar's collapse toggle button, flagged by axe-core (`aria-allowed-role`) and WAVE (`aria_menu_broken`) when the navbar collapses to the hamburger at narrow viewports.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.

## Other fixes and improvements

- [#14735](https://github.com/quarto-dev/quarto-cli/issues/14735) Fix a crash when the `QUARTO_R` environment variable is set to a malformed path. Quarto now warns and falls back to other R lookup strategies instead of aborting the render. ([posit-dev/positron#15614](https://github.com/posit-dev/positron/discussions/15614))
