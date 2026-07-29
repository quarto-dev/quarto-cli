All changes included in 1.11:

## Accessibility

- ([#13463](https://github.com/quarto-dev/quarto-cli/issues/13463)): The dark/light mode toggle is now a switch (`button` with `role="switch"`, `aria-checked`, and a localized `aria-label`) instead of a nameless link, in all three places it is created: website navbars/sidebars, plain documents with a light/dark theme pair, and multi-page dashboards. Screen readers now announce the control's name, role, and which mode is active, and Space activates it as well as Enter. Custom CSS targeting `a.quarto-color-scheme-toggle` should now target the `button` element instead.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.
