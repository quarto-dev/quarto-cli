All changes included in 1.7:

## Regression fixes

- ([#11509](https://github.com/quarto-dev/quarto-cli/issues/11509)): Fix link-decoration regression in HTML formats.
- ([#11532](https://github.com/quarto-dev/quarto-cli/issues/11532)): Fix regression for [#660](https://github.com/quarto-dev/quarto-cli/issues/660), which causes files to have incorrect permissions when Quarto is installed in a location not writable by the current user.
- ([#11580](https://github.com/quarto-dev/quarto-cli/issues/11580)): Fix regression with documents containing `categories` fields that are not strings.

## YAML validation

- ([#11654](https://github.com/quarto-dev/quarto-cli/issues/11654)): Allow `page-inset` as value in `column` key for code cells.

## `quarto check`

- ([#11608](https://github.com/quarto-dev/quarto-cli/pull/11608)): Do not issue error message when calling `quarto check info`.

## Lua Filters and extensions

- ([#11526](https://github.com/quarto-dev/quarto-cli/pull/11526)):
  General improvements to the style and robustness of Quarto's Lua code.
  This also provides a new public function `quarto.utils.is_empty_node`
  that allows to check whether a node is empty, i.e., whether it's an
  empty list, has no child nodes, and contains no text.
