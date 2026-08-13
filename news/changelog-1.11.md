All changes included in 1.11:

## Formats

### `html`

- ([#14774](https://github.com/quarto-dev/quarto-cli/issues/14774)): Fix missing keyboard focus indicator on the code tools button and on a website's sidebar toggle and sidebar search buttons.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.
