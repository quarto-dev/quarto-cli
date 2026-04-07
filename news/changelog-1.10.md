All changes included in 1.10:

## Regression fixes

- ([#14267](https://github.com/quarto-dev/quarto-cli/issues/14267)): Fix Windows paths with accented characters (e.g., `C:\Users\Sébastien\`) breaking dart-sass compilation.
- ([#14281](https://github.com/quarto-dev/quarto-cli/issues/14281)): Fix transient `.quarto_ipynb` files accumulating during `quarto preview` with Jupyter engine.
- ([#14298](https://github.com/quarto-dev/quarto-cli/issues/14298)): Fix `quarto preview` browse URL including output filename (e.g., `hello.html`) for single-file documents, breaking Posit Workbench proxied server access.

## Formats

### `typst`

- ([#14261](https://github.com/quarto-dev/quarto-cli/issues/14261)): Fix theorem/example block titles containing inline code producing invalid Typst markup when syntax highlighting is applied.

## Commands

### `quarto preview`

- ([#14281](https://github.com/quarto-dev/quarto-cli/issues/14281)): Avoid creating a duplicate `.quarto_ipynb` file on preview startup for single-file Jupyter documents.

### `quarto create`

- ([#14250](https://github.com/quarto-dev/quarto-cli/issues/14250)): Fix `quarto create` producing read-only files when Quarto is installed via system packages (e.g., `.deb`). Files copied from installed resources now have user-write permission ensured.

## Lua API

- ([#14297](https://github.com/quarto-dev/quarto-cli/pull/14297)): Fix `quarto.utils.is_empty_node()` returning inverted results for text nodes (`Str`, `Code`, `RawInline`).

## Other fixes and improvements

- ([#6651](https://github.com/quarto-dev/quarto-cli/issues/6651)): Fix dart-sass compilation failing in enterprise environments where `.bat` files are blocked by group policy.
- ([#14255](https://github.com/quarto-dev/quarto-cli/issues/14255)): Fix shortcodes inside inline and display math expressions not being resolved.

