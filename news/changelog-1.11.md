All changes included in 1.11:

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.

## Other fixes and improvements

- Fix a crash when the `QUARTO_R` environment variable is set to a malformed path. Quarto now warns and falls back to other R lookup strategies instead of aborting the render.
