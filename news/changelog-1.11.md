All changes included in 1.11:

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.

## Other fixes and improvements

- ([#14765](https://github.com/quarto-dev/quarto-cli/issues/14765)): Emit `mermaid` diagrams in a `{=html}` raw block. Quarto no longer reads a bare `---` line in the diagram as a YAML front matter delimiter. Before, such a line hid the rest of the document, and the `ojs` cells after it did not run. (author: @mcanouil) (author: @mcanouil)
