All changes included in 1.10:

## Regression fixes

- ([#14267](https://github.com/quarto-dev/quarto-cli/issues/14267)): Fix Windows paths with accented characters (e.g., `C:\Users\Sébastien\`) breaking dart-sass compilation.

## Formats

### `typst`

- ([#14261](https://github.com/quarto-dev/quarto-cli/issues/14261)): Fix theorem/example block titles containing inline code producing invalid Typst markup when syntax highlighting is applied.

## Other fixes and improvements

- ([#6651](https://github.com/quarto-dev/quarto-cli/issues/6651)): Fix dart-sass compilation failing in enterprise environments where `.bat` files are blocked by group policy.

