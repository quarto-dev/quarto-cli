All changes included in 1.11:

## Regression fixes

- ([#14741](https://github.com/quarto-dev/quarto-cli/issues/14741)): Don't wrap the `longtable` environment of a cross-referenceable table in a `{ ... }` group. Pandoc emits that group to scope its `\def\LTcaptype{none}`, which Quarto removes when adding its own `\caption`; keeping the now-pointless group broke packages that move the environment out of the text flow, such as `endfloat` with `\DeclareDelayedFloatFlavor*{longtable}{table}`.

## Accessibility

- ([#14615](https://github.com/quarto-dev/quarto-cli/issues/14615)): Fix invalid `role="menu"` on the website navbar's collapse toggle button, flagged by axe-core (`aria-allowed-role`) and WAVE (`aria_menu_broken`) when the navbar collapses to the hamburger at narrow viewports.
- ([#12116](https://github.com/quarto-dev/quarto-cli/issues/12116), [#4935](https://github.com/quarto-dev/quarto-cli/issues/4935)): Website sidebar section toggles are now `<button>` elements, so the keyboard can reach them and `Enter` or `Space` can operate them. Each toggle carries `aria-expanded`, and `aria-labelledby` names each disclosed list after its own section. The toggles no longer carry `role="navigation"`, which removed a spurious navigation landmark from every section.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.

## Other fixes and improvements

- [#14735](https://github.com/quarto-dev/quarto-cli/issues/14735) Fix a crash when the `QUARTO_R` environment variable is set to a malformed path. Quarto now warns and falls back to other R lookup strategies instead of aborting the render. ([posit-dev/positron#15614](https://github.com/posit-dev/positron/discussions/15614))
