All changes included in 1.11:

## Projects

### Websites

- ([#7058](https://github.com/quarto-dev/quarto-cli/issues/7058)): Move the navbar search control after the navigation links and tools in the DOM so keyboard and screen-reader order matches the visual order. The rendered layout is unchanged (navbar positioning is controlled by CSS `order`), but custom CSS or JS that relied on `#quarto-search` preceding the navbar links in the DOM may need updating.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.
