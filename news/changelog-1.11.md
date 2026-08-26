All changes included in 1.11:

## Accessibility

- ([#14376](https://github.com/quarto-dev/quarto-cli/issues/14376)): Add a distinct, localizable `aria-label` to each navigation landmark of websites and books: the navbar, the sidebar, the mobile secondary nav, the previous/next page navigation, and the breadcrumbs (previously hardcoded English `breadcrumb`). The new `navigation-*-label` language keys can be overridden with `language:` metadata.
- ([#14376](https://github.com/quarto-dev/quarto-cli/issues/14376)): Label the table of contents `<nav>` with its localized title (`aria-labelledby`), in `html` and `revealjs` output, so assistive technology can tell it apart from other navigation landmarks.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.
