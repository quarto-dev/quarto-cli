All changes included in 1.11:

## Formats

### All Formats

- ([#14772](https://github.com/quarto-dev/quarto-cli/issues/14772)): Custom `language` keys now reach templates through `$quarto.language.<key>$`. A key that Quarto does not ship passed schema validation and was merged over the defaults, then discarded before templates saw it, so it expanded to an empty string with no warning. (author: @mcanouil)

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.
