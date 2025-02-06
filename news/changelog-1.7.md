All changes included in 1.7:

## Regression fixes

- ([#11509](https://github.com/quarto-dev/quarto-cli/issues/11509)): Fix link-decoration regression in HTML formats.
- ([#11532](https://github.com/quarto-dev/quarto-cli/issues/11532)): Fix regression for [#660](https://github.com/quarto-dev/quarto-cli/issues/660), which causes files to have incorrect permissions when Quarto is installed in a location not writable by the current user.
- ([#11549](https://github.com/quarto-dev/quarto-cli/issues/11549)): Fix regression in rendering `dashboard` tabsets into cards without titles.
- ([#11580](https://github.com/quarto-dev/quarto-cli/issues/11580)): Fix regression with documents containing `categories` fields that are not strings.
- ([#11752](https://github.com/quarto-dev/quarto-cli/issues/11752)): Fix regression with non-alphanumeric characters in `categories` preventing correct filtering of listing.
- ([#11561](https://github.com/quarto-dev/quarto-cli/issues/11561)): Fix a regression with `$border-color` that impacted, callouts borders, tabset borders, and table borders of the defaults themes. `$border-color` is now correctly a mixed of `$body-color` and `$body-bg` even for the default theme.
- ([#11943](https://github.com/quarto-dev/quarto-cli/issues/11943)): Fix callout title color on dark theme in revealjs following Revealjs update in quarto 1.6.

## YAML validation

- ([#11654](https://github.com/quarto-dev/quarto-cli/issues/11654)): Allow `page-inset` as value in `column` key for code cells.

## Website projects

- ([#11701](https://github.com/quarto-dev/quarto-cli/issues/11701)): Wrap HTML emitted by EJS templates in `{=html}` blocks to avoid memory blowup issues with Pandoc's parser.

## Blog projects

- ([#11745](https://github.com/quarto-dev/quarto-cli/issues/11745)): Fix categories links under post title in post with url encoded path (e.g. with space or other special characters).

## Book projects

- ([#11520](https://github.com/quarto-dev/quarto-cli/issues/11520)): Book's cover image now escapes lightbox treatment, which was incorrectly applied to it when `lightbox: true` was set in the book's configuration.

## `quarto check`

- ([#11608](https://github.com/quarto-dev/quarto-cli/pull/11608)): Do not issue error message when calling `quarto check info`.

## `html` format

- ([#11860](https://github.com/quarto-dev/quarto-cli/issues/11860)): ES6 modules that import other local JS modules in documents with `embed-resources: true` are now correctly embedded.

## `pdf` format

- ([#11835](https://github.com/quarto-dev/quarto-cli/issues/11835)): Take markdown structure into account when detecting minimum heading level.
- ([#11903](https://github.com/quarto-dev/quarto-cli/issues/11903)): `crossref` configuration like `fig-title` or `tbl-title` now correctly supports multi word values, e.g. `fig-title: 'Supplementary Figure'`.
- ([#11878](https://github.com/quarto-dev/quarto-cli/issues/11878)): Correctly fixup raw LaTeX table having an unexpected table env with options (e.g `\begin{table}[c]`) to be handled as crossref table.

## `typst` format

- ([#11578](https://github.com/quarto-dev/quarto-cli/issues/11578)): Typst column layout widths use fractional `fr` units instead of percent `%` units for unitless and default widths in order to fill the enclosing block and not spill outside it.
- ([#11676](https://github.com/quarto-dev/quarto-cli/pull/11676)): Convert unitless image widths from pixels to inches for column layouts.
- ([#11835](https://github.com/quarto-dev/quarto-cli/issues/11835)): Take markdown structure into account when detecting minimum heading level.
- ([#11964](https://github.com/quarto-dev/quarto-cli/issues/11964)): Using panel layout without a crossref label now correctly do not add an empty `#block[]` that was leading to an unnecessary space in output.

## Lua Filters and extensions

- ([#11526](https://github.com/quarto-dev/quarto-cli/pull/11526)):
  General improvements to the style and robustness of Quarto's Lua code.
  This also provides a new public function `quarto.utils.is_empty_node`
  that allows to check whether a node is empty, i.e., whether it's an
  empty list, has no child nodes, and contains no text.
- ([#11699](https://github.com/quarto-dev/quarto-cli/issues/11699)): Fix crash with `video` shortcode inside HTML comments.
- Expose new `quarto.paths.tinytex_bin_dir` in Quarto's Lua API. If TinyTeX is found by Quarto, this will be set to the path to the `bin` directory of the TinyTeX installation where command line tool are located (e.g., `pdflatex`, `tlmgr`, etc.). If TinyTeX is not found, this will be `nil`, meaning Quarto will use the system PATH to find the command line tools.
- Fix `pandoc.mediabag` Lua typings so autocompletions work with the Lua LSP integration.
- ([#11896](https://github.com/quarto-dev/quarto-cli/pull/11896)): fix `\f` (`{{< pagebreak >}}`) form feed character not valid in PowerPoint (`pptx`).
- ([#11664](https://github.com/quarto-dev/quarto-cli/issues/11664)): `lipsum` shortcode is no longer randomly generated by default, use `{{< lipsum random=true >}}` to restore randomness.

## Engines

### `julia`

- ([#11659](https://github.com/quarto-dev/quarto-cli/pull/11659)): Fix escaping bug where paths containing spaces or backslashes break server startup on Windows.
- ([#12020](https://github.com/quarto-dev/quarto-cli/pull/12020)): Update QuartoNotebookRunner to 0.12.1.

## Other Fixes and Improvements

- ([#7260](https://github.com/quarto-dev/quarto-cli/issues/7260)): Add support for `active` class in tabsets so the `.active` tab shows up by default.
- ([#8613](https://github.com/quarto-dev/quarto-cli/issues/8613)): Fix `giscus` color on load to support dark mode (by @kv9898).
- ([#11441](https://github.com/quarto-dev/quarto-cli/issues/11441)): Don't add newlines around shortcodes during processing.
- ([#11643](https://github.com/quarto-dev/quarto-cli/issues/11643)): Improve highlighting of nested code block inside markdown code block, i.e. using ` ```{{python}} ` or ` ```python ` inside ` ````markdown` fenced code block.
- ([fb38eb5](https://github.com/quarto-dev/quarto-cli/commit/fb38eb56c11e09f44cef58fd3b697ff24bb5a3f3)) Use the `latest` parser for Acorn when analyzing JS code imported from OJS blocks.
- ([#10532](https://github.com/quarto-dev/quarto-cli/issues/10532)): Quarto changed default of `--headless=old` to `--headless` as [Chrome 132 has removed old headless mode](https://developer.chrome.com/blog/removing-headless-old-from-chrome) and only support new mode. For using old mode, `QUARTO_CHROMIUM` could be set to a [new `chrome-headless-shell` binary](https://developer.chrome.com/blog/chrome-headless-shell) or too an older chrome version (between 128 and 132) and `QUARTO_CHROMIUM_HEADLESS_MODE` set to `old` for using old headless mode with that compatabitle version.
- ([#10961](https://github.com/quarto-dev/quarto-cli/issues/10961)): Add more information on which Chrome Headless will be used in `quarto check install`. This is helpful to help debug mermaid issues.
