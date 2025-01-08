All changes included in 1.7:

## Regression fixes

- ([#11509](https://github.com/quarto-dev/quarto-cli/issues/11509)): Fix link-decoration regression in HTML formats.
- ([#11532](https://github.com/quarto-dev/quarto-cli/issues/11532)): Fix regression for [#660](https://github.com/quarto-dev/quarto-cli/issues/660), which causes files to have incorrect permissions when Quarto is installed in a location not writable by the current user.
- ([#11549](https://github.com/quarto-dev/quarto-cli/issues/11549)): Fix regression in rendering `dashboard` tabsets into cards without titles.
- ([#11580](https://github.com/quarto-dev/quarto-cli/issues/11580)): Fix regression with documents containing `categories` fields that are not strings.
- ([#11752](https://github.com/quarto-dev/quarto-cli/issues/11752)): Fix regression with non-alphanumeric characters in `categories` preventing correct filtering of listing.

## YAML validation

- ([#11654](https://github.com/quarto-dev/quarto-cli/issues/11654)): Allow `page-inset` as value in `column` key for code cells.

## Website projects

- ([#11701](https://github.com/quarto-dev/quarto-cli/issues/11701)): Wrap HTML emitted by EJS templates in `{=html}` blocks to avoid memory blowup issues with Pandoc's parser.

## Book projects

- ([#11520](https://github.com/quarto-dev/quarto-cli/issues/11520)): Book's cover image now escapes lightbox treatment, which was incorrectly applied to it when `lightbox: true` was set in the book's configuration.

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
- ([#11699](https://github.com/quarto-dev/quarto-cli/issues/11699)): Fix crash with `video` shortcode inside HTML comments.
- Expose new `quarto.paths.tinytex_bin_dir` in Quarto's Lua API. If TinyTeX is found by Quarto, this will be set to the path to the `bin` directory of the TinyTeX installation where command line tool are located (e.g., `pdflatex`, `tlmgr`, etc.). If TinyTeX is not found, this will be `nil`, meaning Quarto will use the system PATH to find the command line tools.
- Fix `pandoc.mediabag` Lua typings so autocompletions work with the Lua LSP integration.

## Engines

### `julia`

- ([#11659](https://github.com/quarto-dev/quarto-cli/pull/11659)): Fix escaping bug where paths containing spaces or backslashes break server startup on Windows.

## Other Fixes and Improvements

- ([#8613](https://github.com/quarto-dev/quarto-cli/issues/8613)): Fix `giscus` color on load to support dark mode (by @kv9898).
- ([#11441](https://github.com/quarto-dev/quarto-cli/issues/11441)): Don't add newlines around shortcodes during processing.
- ([#11643](https://github.com/quarto-dev/quarto-cli/issues/11643)): Improve highlighting of nested code block inside markdown code block, i.e. using ` ```{{python}} ` or ` ```python ` inside ` ````markdown` fenced code block.
