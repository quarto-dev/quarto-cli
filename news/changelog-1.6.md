All changes included in 1.6:

## Breaking changes

- The syntax for standard library imports in `quarto run` TypeScript files (`*.ts`) changed. Please see <https://prerelease.quarto.org/docs/projects/scripts.html#deno-scripts> for how to make the necessary changes.

## Shortcodes

- ([#10292](https://github.com/quarto-dev/quarto-cli/issues/10292)): Improve shortcode passthrough when handlers are not available.

## `quarto inspect`

- ([#10039](https://github.com/quarto-dev/quarto-cli/issues/10039)): `quarto inspect` properly handles `!expr` tag in metadata.
- ([#10188](https://github.com/quarto-dev/quarto-cli/issues/10188)): `quarto inspect` properly resolves includes across subdirectory boundaries.

## Lua Filters and extensions

- ([#8179](https://github.com/quarto-dev/quarto-cli/issues/8179)): When merging code cells for complex layouts, do not merge cells with different languages.
- ([#8428](https://github.com/quarto-dev/quarto-cli/issues/8428)): only forward cell labels to tables when tables will be cross-referenceable.
- ([#10004](https://github.com/quarto-dev/quarto-cli/issues/10004)): Resolve callout titles, theorem names, and `code-summary` content through `quarto_ast_pipeline()` and `process_shortcodes()`.
- ([#10196](https://github.com/quarto-dev/quarto-cli/issues/10196)): Protect against nil values in `float.caption_long`.
- ([#10328](https://github.com/quarto-dev/quarto-cli/issues/10328)): Interpret subcells as subfloats when subcap count matches subcell count.
- ([#10624](https://github.com/quarto-dev/quarto-cli/issues/10624)): Don't crash when proof environments are empty in `pdf`.
- ([#10858](https://github.com/quarto-dev/quarto-cli/issues/10858)): Don't crash in `gfm` when `content` of a `FloatRefTarget` is of type `Blocks`.
- ([#10894](https://github.com/quarto-dev/quarto-cli/issues/10894)): Fix configuration of title and prefix in callouts for `html`, `revealjs`, `pdf`, and `typst`.
- ([#10999](https://github.com/quarto-dev/quarto-cli/issues/10999)): New API entry point: `quarto.paths.rscript()` to resolve `Rscript` path in Lua filters and extensions consistently with Quarto itself.
- ([#11124](https://github.com/quarto-dev/quarto-cli/pull/11124)): Sort keys when encoding tables as JSON.
- ([#11303](https://github.com/quarto-dev/quarto-cli/issues/11303)): Fix conditional content for divs with repeated attributes.

## `dashboard` Format

- ([#9411](https://github.com/quarto-dev/quarto-cli/issues/9411)): Fix issue with history navigation in dashboards and external links.
- ([#10340](https://github.com/quarto-dev/quarto-cli/issues/10340)): Build card title correctly in the presence of equations and other markup.

## `html` Format

- Fix `kbd` element styling on dark themes.
- ([#10761](https://github.com/quarto-dev/quarto-cli/issues/10761)): Add support for `licence: CC0` to automatically link to Creative Commons licence [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- ([#10817](https://github.com/quarto-dev/quarto-cli/issues/10817)): Ensure that user provided SCSS has precedent over quarto generated scss also for dark theme.
- ([#11124](https://github.com/quarto-dev/quarto-cli/pull/11124)): Use stable order of GLightbox options
- ([#11401](https://github.com/quarto-dev/quarto-cli/issues/11401)): Use EJS comment syntax to hide internal TODO notes from the output.

## `revealjs` Format

- Update to Reveal JS 5.1.0.
  - Support for a [Jump To Slide](https://revealjs.com/jump-to-slide/) menu to quickly navigate between slides. Set `jump-to-slide: false` to opt out.
  - Support for new [Scroll View](https://revealjs.com/scroll-view/) mode with configuration through new `scroll-view` revealjs's format configuration key. A new menu tool has been added to toggle scroll view mode on and off, associated with `R` key by default.
- Styles improvements for Callouts in Revealjs:
  - SCSS variables can be used to customize the appearance of callouts in Revealjs. The following SCSS variables are available:
    - Border width and scale (`$callout-border-width`, `$callout-border-scale`)
    - Border colors (`$callout-color-note`, `$callout-color-tip`, `$callout-color-important`, `$callout-color-caution`, `$callout-color-warning`)
    - Margins (`$callout-margin-top`, `$callout-margin-bottom`)
  - Color for each callout type is now the same as in Bootstrap document `format: html`. This allows for consistent styling across formats. If you prefer other colors, you can override using the new SCSS variables
  - Icon for each callout type is now using SVG like in Bootstrap document `format: html`. This allows for consistent styling across formats.
  - Callouts looks better in slides made smaller and when containing code blocks.
  - To see how callouts looks like in revealjs, see this example: <https://examples.quarto.pub/revealjs-default-callouts-styles>
- Prevent empty SASS built css file to be included in header.
- Remove wrong `sourceMappingUrl` entry in SASS built css.
- ([#7715](https://github.com/quarto-dev/quarto-cli/issues/7715)): Revealjs don't support anymore special Pandoc syntax making BulletList in Blockquotes become incremental list. This was confusing and unexpected behavior. Supported syntax for incremental list is documented at <https://quarto.org/docs/presentations/revealjs/#incremental-lists>.
- ([#9742](https://github.com/quarto-dev/quarto-cli/issues/9742)): Links to cross-referenced images correctly works.
- ([#9558](https://github.com/quarto-dev/quarto-cli/issues/9558)): To prevent default footer to show on slide, set `footer='false'` attribute on the slide header, e.g. `## Slide with no footer {footer='false'}`
- ([#6012](https://github.com/quarto-dev/quarto-cli/issues/6012)): Add styling for `kbd` element in Revealjs slides.
- ([#10887](https://github.com/quarto-dev/quarto-cli/issues/10887)): Updating default Mathjax used from 2.7.0 to 2.7.9.
- ([#9999](https://github.com/quarto-dev/quarto-cli/issues/9999)): Fix spacing problems of different size elements in columns.
- ([#11146](https://github.com/quarto-dev/quarto-cli/issues/11146)): Fix issue with slide created with `---` and having no title showing up in TOC. Now they don't show up as slide created with empty header e.g. `## `.
- ([#7142](https://github.com/quarto-dev/quarto-cli/issues/7142)): Fix issue in slides with `incremental: true` not working as expected when `code-annotation: hover` or `code-annotation: select`.
- ([#9803](https://github.com/quarto-dev/quarto-cli/issues/9803)): Using url for `logo` to an online svg is now working correctly with `embed-resources: true`.

## `typst` Format

- ([#10168](https://github.com/quarto-dev/quarto-cli/issues/10168)): Support `csl` bibliography style.
- ([#10181](https://github.com/quarto-dev/quarto-cli/issues/10181)): Remove workaround for image dimensions which is no longer necessary and mishandled image paths with spaces.
- ([#10217](https://github.com/quarto-dev/quarto-cli/issues/10217)): Explicitly compute units for image dimensions in `typst` format when they're not given.
- ([#10212](https://github.com/quarto-dev/quarto-cli/issues/10212)): Move Pandoc variables to the function declaration for the default template.
- ([#10438](https://github.com/quarto-dev/quarto-cli/issues/10438)): Ensure Pandoc doesn't emit its own crossref environments for table elements.

## `docx` Format

- ([#10401](https://github.com/quarto-dev/quarto-cli/issues/10401)): Fix crash when `docx` format is used with an empty crossref environment.

## `latex` and `pdf` Format

- ([#10001](https://github.com/quarto-dev/quarto-cli/issues/10001)): Support correct `*-pos` attribute in `FloatRefTarget` nodes with layouts.
- ([#10291](https://github.com/quarto-dev/quarto-cli/issues/10291)): Several improvement regarding Quarto LaTeX engine behavior for missing hyphenation log message:
  - `latex-auto-install: false` now correctly opt out any missing hyphenation packages detection and installation. Only a warning will be thrown if any detected in the log.
  - For default behavior (`latex-auto-install: true`), detection is still happening and missing packages are installed automatically. If it fails, Quarto does not fail anymore as PDF rendering as succeeded already. Only a warning will be thrown to log the installation failure.
  - Log message about hyphenation package missing for `chinese` or `chinese-hans` languages are now ignored.
- ([#10655](https://github.com/quarto-dev/quarto-cli/issues/10655)): Missing fonts from fontspec error are correctly detected and looked for to be installed.
- ([#10816](https://github.com/quarto-dev/quarto-cli/issues/10816)): Warn instead of crash when missing fields in custom crossreference declarations.
- ([#10891](https://github.com/quarto-dev/quarto-cli/issues/10891)): Interpret ANSI color codes in otherwise unformatted code blocks in `pdf` format.

## Projects

- ([#7988](https://github.com/quarto-dev/quarto-cli/issues/7988)): Do not allow `lib-dir` to cause an accidental cleanup of the project directory when its value points to a parent of the project directory.
- ([#10125](https://github.com/quarto-dev/quarto-cli/issues/10125)): Show path to the project when project YAML validation fails.
- ([#10268](https://github.com/quarto-dev/quarto-cli/issues/10268)): `quarto create` supports opening project in Positron, in addition to VS Code and RStudio IDE.
- ([#10285](https://github.com/quarto-dev/quarto-cli/issues/10285)): Include text from before the first chapter sections in search indices. In addition, include text of every element with `.quarto-include-in-search-index` class in search indices.
- ([#10566](https://github.com/quarto-dev/quarto-cli/issues/10566)): Ensure that `quarto run` outputs `stdout` and `stderr` to the correct streams.

### Websites

- ([#2671](https://github.com/quarto-dev/quarto-cli/issues/2671)): Ensure that `--output-dir` works across filesystem boundaries.
- ([#8517](https://github.com/quarto-dev/quarto-cli/issues/8571)), ([#10829](https://github.com/quarto-dev/quarto-cli/issues/10829)): Allow listing categories with non-alphanumeric characters such as apostrophes, etc.
- ([#8932](https://github.com/quarto-dev/quarto-cli/issues/8932)): Escape render ids in markdown pipeline to allow special characters in sidebars/navbars, etc.
- ([#10311](https://github.com/quarto-dev/quarto-cli/issues/10311)): Loosen auto-discovery of images for OpenGraph cards.
- ([#10567](https://github.com/quarto-dev/quarto-cli/issues/10567)): Generate breadcrumbs correctly for documents using a level-1 heading as the title.
- ([#10616](https://github.com/quarto-dev/quarto-cli/issues/10268)): Add a `z-index` setting to the 'back to top' button to ensure it is always visible.
- ([#10864](https://github.com/quarto-dev/quarto-cli/issues/10864)): Support detection of `og:image:alt` attribute from auto-discovered images.
- ([#9905](https://github.com/quarto-dev/quarto-cli/issues/9905)): Setting `search: false` in `navbar` config for `website` in `_quarto.yml` correctly opt-out sidebar.

### Quarto Blog

- ([#10710](https://github.com/quarto-dev/quarto-cli/issues/10710)): Fix an issue with categorie badges as links in the blog post header.

### Manuscript

- Fix an issue on Windows when creating MECA bundles containing special file name like space in the path ([quarto-ext/manuscript-template-rstudio#3](https://github.com/quarto-ext/manuscript-template-rstudio/issues/3)).

## Engines

### `julia`

- ([#10225](https://github.com/quarto-dev/quarto-cli/issues/10225)): Handle API change in `is_manifest_current` in Julia 1.11.
- ([#11013](https://github.com/quarto-dev/quarto-cli/issues/11013)): Fix QuartoNotebookRunner.jl precompilation failure on Julia 1.11.

### `jupyter`

- ([#9134](https://github.com/quarto-dev/quarto-cli/issues/9134)): Add proper fix for `multiprocessing` in notebooks with the Python kernel.
- ([#10097](https://github.com/quarto-dev/quarto-cli/issues/10097)): Ensure papermill parameterization works when default values are set in a cell with labels.

## Chromium support

- ([#11135](https://github.com/quarto-dev/quarto-cli/issues/11135)): Use `--headless=old` mode for Chromium to avoid recent issues with the new `--headless` mode. Setting `--headless=new` can be configured with `QUARTO_CHROMIUM_HEADLESS_MODE=new` environment variable, however it is not recommended new headless mode seems to be unstable. Only use to be unblocked of a situation (like `QUARTO_CHROMIUM_HEADLESS_MODE="none"` if you use an old chrome version somehow that don't support `--headless=old`).
- ([#10170](https://github.com/quarto-dev/quarto-cli/issues/10170)): Quarto should find chrome executable automatically on most OS. If this is does not find it, or a specific version is needed, set `QUARTO_CHROMIUM` environment variable to the executable path.
- Quarto now makes sure that all started chromium instances are closed when the process ends, no matter how it ends (success, error, or interruption).

## Other Fixes and Improvements

- Upgrade `mermaidjs` to 11.2.0.
- Upgrade Pandoc to 3.4.
- Upgrade `deno` to 1.46.3.
- ([#2699](https://github.com/quarto-dev/quarto-cli/issues/2699)): Respect input/output streams in `quarto pandoc`.
- ([#10162](https://github.com/quarto-dev/quarto-cli/issues/10162)): Use Edge on `macOS` as a Chromium browser when available.
- ([#10235](https://github.com/quarto-dev/quarto-cli/issues/10235)): Configure the CI schedule trigger to activate exclusively for the upstream repository.
- ([#10295](https://github.com/quarto-dev/quarto-cli/issues/10235)): Fix regression to return error status to shell when `CommandError` is thrown.
- ([#10332](https://github.com/quarto-dev/quarto-cli/issues/10332)): Use `exitWithCleanup` whenever possible instead of `Deno.exit` to clean up temporary resources.
- ([#10334](https://github.com/quarto-dev/quarto-cli/issues/10334)): Fix `author` field rendered incorrectly in dashboards when multiple authors are present.
- ([#8383](https://github.com/quarto-dev/quarto-cli/issues/8383)), ([#10087](https://github.com/quarto-dev/quarto-cli/issues/10087)), ([#10369](https://github.coma/quarto-dev/quarto-cli/issues/10369)): Track theme generation and file naming through content hashing to allow different themes to coexist in the same project.
- ([#10442](https://github.com/quarto-dev/quarto-cli/issues/10442)): Honor the `semver` requirement in `QUARTO_VERSION_REQUIREMENT` and stop execution when that isn't met.
- ([#10552](https://github.com/quarto-dev/quarto-cli/issues/10552)): Add `contents` shortcode.
- ([#10581](https://github.com/quarto-dev/quarto-cli/issues/10581)): Add `.landscape` div processing to `typst`, `docx` and `pdf` formats to support pages in landscape orientation.
- ([#10591](https://github.com/quarto-dev/quarto-cli/issues/10591)): Make fenced div syntax slightly more robust by removing spaces around the `=` sign ahead of Pandoc's reader.
- ([#10608](https://github.com/quarto-dev/quarto-cli/issues/10608)): Don't overwrite the built-in CSS function `contrast` in Quarto's SCSS.
- ([#10622](https://github.com/quarto-dev/quarto-cli/issues/10622)): Use copy+remove instead of move when needed to support temporary directories in different filesystems.
- ([#10821](https://github.com/quarto-dev/quarto-cli/issues/10821)): Be more conservative in stripping `echo: fenced` from fenced output.
- ([#10890](https://github.com/quarto-dev/quarto-cli/issues/10890)): Don't use ports that Firefox considers unsafe.
- ([#10936](https://github.com/quarto-dev/quarto-cli/issues/10936)): Use `\\` in `meta` shortcode to escape the following character, allowing keys with `.` in them.
- ([#11068](https://github.com/quarto-dev/quarto-cli/issues/11068)): use standard location when writing to standard output to avoid breakage under `self-contained: true`.
- ([#11155](https://github.com/quarto-dev/quarto-cli/pull/11155)): Add cache location information to `quarto check`.

### Languages

- ([#11246](https://github.com/quarto-dev/quarto-cli/pull/11246)): Basque translation for Quarto UI text (credit: @iagobaapellaniz)
