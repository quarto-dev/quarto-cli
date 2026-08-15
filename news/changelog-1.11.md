All changes included in 1.11:

## Projects

- Add support for `!exec` in `metadata-file`/`metadata-files` entries: instead of a path, run a command and merge its stdout (parsed as YAML) into the project/document metadata, e.g. `metadata-files: [!exec ./include-chapters.py --lang en]`.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.
