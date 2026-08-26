All changes included in 1.11:

## Regression fixes

- ([#14741](https://github.com/quarto-dev/quarto-cli/issues/14741)): Don't wrap the `longtable` environment of a cross-referenceable table in a `{ ... }` group. Pandoc emits that group to scope its `\def\LTcaptype{none}`, which Quarto removes when adding its own `\caption`; keeping the now-pointless group broke packages that move the environment out of the text flow, such as `endfloat` with `\DeclareDelayedFloatFlavor*{longtable}{table}`.

## Accessibility

- ([#14376](https://github.com/quarto-dev/quarto-cli/issues/14376)): Add a distinct, localizable `aria-label` to each navigation landmark of websites and books: the navbar, the sidebar, the mobile secondary nav, the previous/next page navigation, and the breadcrumbs (previously hardcoded English `breadcrumb`). The new `navigation-*-label` language keys can be overridden with `language:` metadata.
- ([#14376](https://github.com/quarto-dev/quarto-cli/issues/14376)): Label the table of contents `<nav>` with its localized title (`aria-labelledby`), in `html` and `revealjs` output, so assistive technology can tell it apart from other navigation landmarks.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.

## Other fixes and improvements

- [#14735](https://github.com/quarto-dev/quarto-cli/issues/14735) Fix a crash when the `QUARTO_R` environment variable is set to a malformed path. Quarto now warns and falls back to other R lookup strategies instead of aborting the render. ([posit-dev/positron#15614](https://github.com/posit-dev/positron/discussions/15614))
