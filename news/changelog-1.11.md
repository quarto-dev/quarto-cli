All changes included in 1.11:

## Accessibility

- ([#12116](https://github.com/quarto-dev/quarto-cli/issues/12116), [#4935](https://github.com/quarto-dev/quarto-cli/issues/4935)): Website sidebar section toggles are now `<button>` elements, so the keyboard can reach them and `Enter` or `Space` can operate them. Each toggle carries `aria-expanded`, and `aria-labelledby` names each disclosed list after its own section. The toggles no longer carry `role="navigation"`, which removed a spurious navigation landmark from every section.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.
