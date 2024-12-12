All changes included in 1.7:

## Regression fixes

- ([#11509](https://github.com/quarto-dev/quarto-cli/issues/11509)): Fix link-decoration regression in HTML formats.
- ([#11532](https://github.com/quarto-dev/quarto-cli/issues/11532)): Fix regression for [#660](https://github.com/quarto-dev/quarto-cli/issues/660), which causes files to have incorrect permissions when Quarto is installed in a location not writable by the current user.
- ([#11549](https://github.com/quarto-dev/quarto-cli/issues/11549)): Fix regression in rendering `dashboard` tabsets into cards without titles.
- ([#11580](https://github.com/quarto-dev/quarto-cli/issues/11580)): Fix regression with documents containing `categories` fields that are not strings.

## YAML validation

- ([#11654](https://github.com/quarto-dev/quarto-cli/issues/11654)): Allow `page-inset` as value in `column` key for code cells.

## `quarto check`

- ([#11608](https://github.com/quarto-dev/quarto-cli/pull/11608)): Do not issue error message when calling `quarto check info`.

## `typst` Format

- ([#11578](https://github.com/quarto-dev/quarto-cli/issues/11578)): Typst column layout widths use fractional `fr` units instead of percent `%` units for unitless and default widths in order to fill the enclosing block and not spill outside it.

## Lua Filters and extensions

- ([#11526](https://github.com/quarto-dev/quarto-cli/pull/11526)):
  General improvements to the style and robustness of Quarto's Lua code.
  This also provides a new public function `quarto.utils.is_empty_node`
  that allows to check whether a node is empty, i.e., whether it's an
  empty list, has no child nodes, and contains no text.

## Other Fixes and Improvements

- ([#8613](https://github.com/quarto-dev/quarto-cli/issues/8613)): Fix `giscus` color on load to support dark mode (by @kv9898).
- ([#11441](https://github.com/quarto-dev/quarto-cli/issues/11441)): Don't add newlines around shortcodes during processing.
- ([#11643](https://github.com/quarto-dev/quarto-cli/issues/11643)): Improve highlighting of nested code block inside markdown code block, i.e. using ` ```{{python}} ` or ` ```python ` inside ` ````markdown` fenced code block.
