All changes included in 1.11:

## Commands

### `call`

- ([#14815](https://github.com/quarto-dev/quarto-cli/pull/14815)): Add `quarto call axe`, a hidden experimental command that scans a rendered site for accessibility violations with axe-core across a page × viewport × color-mode matrix, groups them by root-cause signature, reconciles a committed baseline, and can gate CI with `--fail-on`. See `dev-docs/axe-scan.md`.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.
