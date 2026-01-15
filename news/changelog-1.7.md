All changes included in 1.7:

## Regression fixes

- ([#11509](https://github.com/quarto-dev/quarto-cli/issues/11509)): Fix link-decoration regression in HTML formats.
- ([#11532](https://github.com/quarto-dev/quarto-cli/issues/11532)): Fix regression for [#660](https://github.com/quarto-dev/quarto-cli/issues/660), which causes files to have incorrect permissions when Quarto is installed in a location not writable by the current user.
- ([#11549](https://github.com/quarto-dev/quarto-cli/issues/11549)): Fix regression in rendering `dashboard` tabsets into cards without titles.
- ([#11561](https://github.com/quarto-dev/quarto-cli/issues/11561)): Fix a regression with `$border-color` that impacted, callouts borders, tabset borders, and table borders of the defaults themes. `$border-color` is now correctly a mixed of `$body-color` and `$body-bg` even for the default theme.
- ([#11580](https://github.com/quarto-dev/quarto-cli/issues/11580)): Fix regression with documents containing `categories` fields that are not strings.
- ([#11659](https://github.com/quarto-dev/quarto-cli/pull/11659)): `julia` engine - Fix escaping bug where paths containing spaces or backslashes break server startup on Windows.
- ([#11752](https://github.com/quarto-dev/quarto-cli/issues/11752)): Fix regression with non-alphanumeric characters in `categories` preventing correct filtering of listing.
- ([#11943](https://github.com/quarto-dev/quarto-cli/issues/11943)): Fix callout title color on dark theme in revealjs following Revealjs update in quarto 1.6.
- ([#11990](https://github.com/quarto-dev/quarto-cli/issues/11990)): Do not print parameter cell in parameterized Jupyter notebooks.
- ([#12147](https://github.com/quarto-dev/quarto-cli/issues/12147)): for RevealJS format, `serif` and `simple` themes defaults back to have their heading color (`$presentation-heading-color`) to be the same as the body color (`$body-color`) as in Quarto 1.5.

## Dependencies

- Update `typst` to `0.13.0`.
- Update `pandoc` to `3.6.3`.
- Update `dart-sass` to `1.85.1`.
- Update `esbuild` to `0.19.12`.

## YAML validation

- ([#10251](https://github.com/quarto-dev/quarto-cli/issues/10251)): EJS template for website now uses proper object to get alt text for logo in sidebar.
- ([#11654](https://github.com/quarto-dev/quarto-cli/issues/11654)): Allow `page-inset` as value in `column` key for code cells.
- ([#12151](https://github.com/quarto-dev/quarto-cli/issues/12151)): Fix YAML validation in computations cell on Windows. Validate YAML in documents in `julia` engine.

## Projects

### `website`

- ([#8238](https://github.com/quarto-dev/quarto-cli/issues/8238)): Listing categories are now sorted case-insensitively.
- ([#10501](https://github.com/quarto-dev/quarto-cli/issues/10501)): Improve documentation of `repo-actions` option.
- ([#11701](https://github.com/quarto-dev/quarto-cli/issues/11701)): Wrap HTML emitted by EJS templates in `{=html}` blocks to avoid memory blowup issues with Pandoc's parser.
- ([#12134](https://github.com/quarto-dev/quarto-cli/issues/12134)): Forward `logo.small` images in `_brand.yml` files to a website `favicon`.

### `blog`

- ([#11745](https://github.com/quarto-dev/quarto-cli/issues/11745)): Fix categories links under post title in post with url encoded path (e.g. with space or other special characters).

### `book`

- ([#11520](https://github.com/quarto-dev/quarto-cli/issues/11520)): Book's cover image now escapes lightbox treatment, which was incorrectly applied to it when `lightbox: true` was set in the book's configuration.
- ([#12134](https://github.com/quarto-dev/quarto-cli/issues/12134)): Forward `logo.small` images in `_brand.yml` files to the `favicon` of the book's website.

## Commands

### `quarto check`

- ([#10047](https://github.com/quarto-dev/quarto-cli/issues/10047)): `quarto check` will now check binary dependency versions strictly by default. Use `quarto check --no-strict` to revert to old behavior.
- ([#10561](https://github.com/quarto-dev/quarto-cli/issues/10561)): `quarto check` will now report paths of binary dependencies.
- ([#11608](https://github.com/quarto-dev/quarto-cli/pull/11608)): Do not issue error message when calling `quarto check info`.
- ([#12433](https://github.com/quarto-dev/quarto-cli/pull/12433)): Add `--output` option to `quarto check` to produce structured JSON output.

### `quarto convert`

- ([#12042](https://github.com/quarto-dev/quarto-cli/issues/12042)): Preserve Markdown content that follows YAML metadata in a `raw` .ipynb cell.
- ([#12318](https://github.com/quarto-dev/quarto-cli/issues/12318)): Ensure enough line breaks between cells that might be trimmed.

### `quarto inspect`

- ([#12336](https://github.com/quarto-dev/quarto-cli/issues/12336)): Clean up transient files created by `quarto inspect`.

## Formats

### `dashboard`

- ([#11338](https://github.com/quarto-dev/quarto-cli/issues/11338)): Remove unused datatables imports when appropriate.

### `html`

- ([#1325](https://github.com/quarto-dev/quarto-cli/issues/1325)): Dark Mode pages should not flash light on reload. (Nor should Light Mode pages flash dark.)
- ([#1470](https://github.com/quarto-dev/quarto-cli/issues/1470)): `respect-user-color-scheme` enables checking the media query `prefers-color-scheme` for user dark mode preference. Author preference still influences stylesheet order and NoJS experience. Defaults to `false`, leaving to author preference.
- ([#10780](https://github.com/quarto-dev/quarto-cli/issues/10780)): improve `link-external-filter` documentation.
- ([#11860](https://github.com/quarto-dev/quarto-cli/issues/11860)): ES6 modules that import other local JS modules in documents with `embed-resources: true` are now correctly embedded.
- ([#11911](https://github.com/quarto-dev/quarto-cli/issues/11911)): Code highlighting colors for tokens are now the same between code blocks and inline code when using Pandoc's syntax highlighting.
- ([#12118](https://github.com/quarto-dev/quarto-cli/issues/12118)): Don't hide `:focus` on code-copy button.
- ([#12277](https://github.com/quarto-dev/quarto-cli/pull/12277)): Provide light and dark plot and table renderings with `renderings: [light,dark]`
- ([#12307](https://github.com/quarto-dev/quarto-cli/issues/12307)): Tabsets using `tabby.js` in non-boostrap html (`theme: pandoc`, `theme: none` or `minimal: true`) now correctly render reactive content when `server: shiny` is used.
- ([#12319](https://github.com/quarto-dev/quarto-cli/pull/12319)): Provide switchable light and dark brands for a page with `brand.light` and `brand.dark`.
- ([#12356](https://github.com/quarto-dev/quarto-cli/issues/12356)): Remove duplicate id in HTML document when using `#lst-` prefix label for using Quarto crossref.

### `pdf`

- ([#11695](https://github.com/quarto-dev/quarto-cli/issues/11695)): Translate ANSI color codes more carefully inside `highlighting` environments.
- ([#11835](https://github.com/quarto-dev/quarto-cli/issues/11835)): Take markdown structure into account when detecting minimum heading level.
- ([#11878](https://github.com/quarto-dev/quarto-cli/issues/11878), [#12085](https://github.com/quarto-dev/quarto-cli/issues/12085)): Correctly fixup raw LaTeX table having an unexpected table env with options (e.g `\begin{table}[!ht]`) to be handled as crossref table.
- ([#11903](https://github.com/quarto-dev/quarto-cli/issues/11903)): `crossref` configuration like `fig-title` or `tbl-title` now correctly supports multi word values, e.g. `fig-title: 'Supplementary Figure'`.
- ([#12344](https://github.com/quarto-dev/quarto-cli/issues/12344)): Ensure decorated code blocks do not float when inside layout elements.
- Update to Pandoc's LaTeX template following Pandoc 3.6.3 support:
  - `format: beamer` now uses its own template. The main template for latex does not use `$if(beamer)$` anymore, and the new template for beamer uses the same partials as latex one.
  - Improved Babel support:
    - New `babeloptions` variable in the template to allow for more flexible Babel options.
    - `doc-class.tex` Quarto's partial has been updated as Babel options have been moved to `documentclass` definition in `doc-class.tex` Quarto's partial.
  - New partials available for `format: latex` and `format: beamer`:
    - Pandoc now uses partials for its latex templates, and they are available through `template-partials`. Pandoc's partials uses `.latex` extension: `passoptions.latex`, `common.latex`, `font-settings.latex`, `fonts.latex`, `hypersetup.latex`, `after-header-includes.latex`
    - New Quarto partials: `babel-lang.tex`, `biblio-config.tex`. Quarto's partials uses `.tex` extension.
  - BREAKING CHANGE for templates authors: `common.latex` does now uses `pandoc.tex` partial from Quarto, which include now part of the content that was in main `template.tex`. If you modify `pandoc.tex` as part of a custom format, it should be updated to new content.

### `jats`

- Update to Pandoc's template following Pandoc 3.6.3 support:
  - `article.jats_publishing` partials now support `author.roles`

### `revealjs`

- ([#12307](https://github.com/quarto-dev/quarto-cli/issues/12307)): Tabsets using `tabby.js` in Revealjs now correctly render reactive content when `server: shiny` is used.

### `typst` format

- ([#11578](https://github.com/quarto-dev/quarto-cli/issues/11578)): Typst column layout widths use fractional `fr` units instead of percent `%` units for unitless and default widths in order to fill the enclosing block and not spill outside it.
- ([#11676](https://github.com/quarto-dev/quarto-cli/pull/11676)): Convert unitless image widths from pixels to inches for column layouts.
- ([#11835](https://github.com/quarto-dev/quarto-cli/issues/11835)): Take markdown structure into account when detecting minimum heading level.
- ([#11964](https://github.com/quarto-dev/quarto-cli/issues/11964)): Using panel layout without a crossref label now correctly do not add an empty `#block[]` that was leading to an unnecessary space in output.
- ([#12387](https://github.com/quarto-dev/quarto-cli/pull/12387)): `brand-mode` chooses whether to use `light` (default) or `dark` brand yml.
- ([#12825](https://github.com/quarto-dev/quarto-cli/issues/11825)): Callouts look better with dark brands, mixing the title color and using brand background color for body.
- ([#12354](https://github.com/quarto-dev/quarto-cli/issues/12354)): CodeBlock in Listing with `#lst-` prefix are now correctly highlighted.

## Engines

### `julia`

- ([#11803](https://github.com/quarto-dev/quarto-cli/pull/11803)): Added subcommands `status`, `kill`, `close [--force]` and `log` under the new CLI command `quarto call engine julia`.
- ([#12121](https://github.com/quarto-dev/quarto-cli/pull/12121)): Update QuartoNotebookRunner to 0.17.0. Support for evaluating Python cells via [PythonCall.jl](https://github.com/JuliaPy/PythonCall.jl) added. Support for notebook caching via `execute.cache` added.
- ([#12151](https://github.com/quarto-dev/quarto-cli/pull/12151)): Basic YAML validation is now active for documents using Julia engine.

### `jupyter`

- ([#9089](https://github.com/quarto-dev/quarto-cli/issues/9089)): Serialize compound `jupyter` metadata into a special key-value attribute to not break Pandoc's fenced div parsing.
- ([#10113](https://github.com/quarto-dev/quarto-cli/issues/10113)): KaTeX will now load correctly in `engine: jupyter` documents using `emebed-resources: true`.
- ([#12114](https://github.com/quarto-dev/quarto-cli/issues/12114)): `JUPYTERCACHE` environment variable from [Jupyter cache CLI](https://jupyter-cache.readthedocs.io/en/latest/using/cli.html) is now respected by Quarto when `cache: true` is used. This environment variable allows to change the path of the cache directory.
- ([#12228](https://github.com/quarto-dev/quarto-cli/issues/12228)): `quarto render` will now fails if errors are detected at IPython display level. Setting `error: true` globally or at cell level will keep the error to show in output and not stop the rendering.
- ([#12374](https://github.com/quarto-dev/quarto-cli/issues/12374)): Detect language properly in Jupyter notebooks that lack the `language` field in their `kernelspec`s.

## Quarto PDF rendering

- ([#12194](https://github.com/quarto-dev/quarto-cli/issues/12194)): More specific checks added in log parsing to automatically find missing fonts.

## Shiny

- ([#12059](https://github.com/quarto-dev/quarto-cli/issues/12059)): `quarto preview` now correctly run on Windows an interactive Quarto doc with Jupyter engine and py-shiny, when using a `*.py` file as resource.

## Lua Filters and extensions

- Add `quarto.paths.tinytex_bin_dir` to Quarto's Lua API. If TinyTeX is found by Quarto, this will be set to the path to the `bin` directory of the TinyTeX installation where command line tool are located (e.g., `pdflatex`, `tlmgr`, etc.). If TinyTeX is not found, this will be `nil`, meaning Quarto will use the system PATH to find the command line tools.
- Fix `pandoc.mediabag` Lua typings so autocompletions work with the Lua LSP integration.
- ([#11379](https://github.com/quarto-dev/quarto-cli/issues/11379)): Add `version` shortcode to display the current Quarto version.
- ([#11526](https://github.com/quarto-dev/quarto-cli/pull/11526)): General improvements to the style and robustness of Quarto's Lua code. This also provides a new public function `quarto.utils.is_empty_node` that allows to check whether a node is empty, i.e., whether it's an empty list, has no child nodes, and contains no text.
- ([#11664](https://github.com/quarto-dev/quarto-cli/issues/11664)): `lipsum` shortcode is no longer randomly generated by default, use `{{< lipsum random=true >}}` to restore randomness.
- ([#11699](https://github.com/quarto-dev/quarto-cli/issues/11699)): Fix crash with `video` shortcode inside HTML comments.
- ([#11896](https://github.com/quarto-dev/quarto-cli/pull/11896)): fix `\f` (`{{< pagebreak >}}`) form feed character not valid in PowerPoint (`pptx`).
- ([#12326](https://github.com/quarto-dev/quarto-cli/issues/12326)): Add `quarto.shortcode.*` API entry points for shortcode developers.
- ([#12365](https://github.com/quarto-dev/quarto-cli/pull/12365)): `brand color` shortcode takes an optional `brandMode` second parameter, default `light`.
- ([#12453](https://github.com/quarto-dev/quarto-cli/issues/12453)): Expose `_quarto.modules.brand` as `quarto.brand` and add `has_mode()` function.
- ([#12564](https://github.com/quarto-dev/quarto-cli/issues/12564)): `brand logo` shortcode also takes an optional `brandMode` second parameter, default `light`.

### Conditional Content

- ([#4411](https://github.com/quarto-dev/quarto-cli/issues/12462)): Added support for new format and aliases in `when-format` and `unless-format`: `confluence`, `docusaurus` (and `docusaurus-md`), `email`, `dashboard`, `gfm`, `hugo` (and `hugo-md`).

### Quarto Lua API

- ([#4411](https://github.com/quarto-dev/quarto-cli/issues/12462)): `quarto.format.is_format` is now working as expected with support of more aliases: `confluence`, `docusaurus` (and `docusaurus-md`), `email`, `dashboard`, `gfm`, `hugo` (and `hugo-md`)
- ([#12299](https://github.com/quarto-dev/quarto-cli/issues/12299)): `quarto.doc.pdf_engine()` now correctly returns the PDF engine used for the document. `quarto.doc.cite_method()` now returns `nil` if no citation method will be used (i.e. no references is the document set).

## Languages

- ([#12366](https://github.com/quarto-dev/quarto-cli/pull/12366)): Added Bulgarian translation for Quarto UI text (credit: @sakelariev)

## `quarto publish`

- ([#9929](https://github.com/quarto-dev/quarto-cli/issues/9929)): `quarto publish gh-pages` will now clean previous worktree directory leftover from previous deploys.

## Other Fixes and Improvements

- A new folder `quarto-session-temp` can be created in `.quarto` to store temporary files created by Quarto during a rendering. Reminder: `.quarto` is for internal use of Quarto and should not be versioned (thus added to `.gitignore`).
- ([fb38eb5](https://github.com/quarto-dev/quarto-cli/commit/fb38eb56c11e09f44cef58fd3b697ff24bb5a3f3)) Use the `latest` parser for Acorn when analyzing JS code imported from OJS blocks.
- ([#7260](https://github.com/quarto-dev/quarto-cli/issues/7260)): Add support for `active` class in tabsets so the `.active` tab shows up by default.
- ([#7757](https://github.com/quarto-dev/quarto-cli/issues/7757)): Session temporary files are now cleaned up when the session ends abnormally (e.g. `Ctrl+C`) also on Windows.
- ([#8613](https://github.com/quarto-dev/quarto-cli/issues/8613)): Fix `giscus` color on load to support dark mode (by @kv9898).
- ([#9867](https://github.com/quarto-dev/quarto-cli/issues/9867)): Blank lines are now trimmed in Raw HTML Table blocks.
- ([#10532](https://github.com/quarto-dev/quarto-cli/issues/10532)): Changed default of `--headless=old` to `--headless` as [Chrome 132 has removed old headless mode](https://developer.chrome.com/blog/removing-headless-old-from-chrome) and only support new mode. To use old mode, set `QUARTO_CHROMIUM` to a [new `chrome-headless-shell` binary](https://developer.chrome.com/blog/chrome-headless-shell) or to an older chrome version (between 128 and 132). Set `QUARTO_CHROMIUM_HEADLESS_MODE` to `old` to use old headless mode with that compatible version.
- ([#10961](https://github.com/quarto-dev/quarto-cli/issues/10961)): Add more information on which Chrome Headless will be used in `quarto check install`. This is helpful to help debug mermaid issues.
- ([#11441](https://github.com/quarto-dev/quarto-cli/issues/11441)): Don't add newlines around shortcodes during processing.
- ([#11606](https://github.com/quarto-dev/quarto-cli/discussions/11606)): Added a new `QUARTO_DOCUMENT_FILE` env var available to computation engine to the name of the file currently being rendered.
- ([#11643](https://github.com/quarto-dev/quarto-cli/issues/11643)): Improve highlighting of nested code block inside markdown code block, i.e. using ` ```{{python}} ` or ` ```python ` inside ` ````markdown` fenced code block.
- ([#11788](https://github.com/quarto-dev/quarto-cli/issues/11788)): `quarto add` and `quarto remove` will return non-zero code when they fail.
- ([#11803](https://github.com/quarto-dev/quarto-cli/pull/11803)): Added a new CLI command `quarto call`. First users of this interface are the new `quarto call engine julia ...` subcommands.
- ([#11951](https://github.com/quarto-dev/quarto-cli/issues/11951)): Raw LaTeX table without `tbl-` prefix label for using Quarto crossref are now correctly passed through unmodified.
- ([#11967](https://github.com/quarto-dev/quarto-cli/issues/11967)): Produce a better error message when YAML metadata with `!expr` tags are used outside of `knitr` code cells.
- ([#12117](https://github.com/quarto-dev/quarto-cli/issues/12117)): Color output to stdout and stderr is now correctly rendered for `html` format in the Jupyter and Julia engines.
- ([#12264](https://github.com/quarto-dev/quarto-cli/issues/12264)): Upgrade `dart-sass` to 1.85.1.
- ([#12238](https://github.com/quarto-dev/quarto-cli/issues/12238)): Do not truncate very long console errors (e.g. in Jupyter Notebook with backtrace).
- ([#12338](https://github.com/quarto-dev/quarto-cli/issues/12338)): Add an additional workaround for the SCSS parser used in color variable extraction.
- ([#12369](https://github.com/quarto-dev/quarto-cli/pull/12369)): `quarto preview` correctly throws a YAML validation error when a `format` key does not conform.
- ([#12459](https://github.com/quarto-dev/quarto-cli/pull/12459)): Add `.page-inset-*` classes to completions.
- ([#12492](https://github.com/quarto-dev/quarto-cli/pull/12492)): Improve shortcode extension template with new parameters and a link to docs.
- ([#12513](https://github.com/quarto-dev/quarto-cli/issues/12513)): Fix an issue with `quarto preview` when using **DiagrammeR** R package for Graphiz diagram.
