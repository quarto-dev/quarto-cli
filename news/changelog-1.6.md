All changes included in 1.6:

## Breaking changes

- The syntax for standard library imports in `quarto run` TypeScript files (`*.ts`) changed. Please see https://prerelease.quarto.org/docs/projects/scripts.html#deno-scripts for how to make the necessary changes.

## `quarto inspect`

- ([#10039](https://github.com/quarto-dev/quarto-cli/issues/10039)): `quarto inspect` properly handles `!expr` tag in metadata.
- ([#10188](https://github.com/quarto-dev/quarto-cli/issues/10188)): `quarto inspect` properly resolves includes across subdirectory boundaries.

## Lua Filters and extensions

- ([#8179](https://github.com/quarto-dev/quarto-cli/issues/8179)): When merging code cells for complex layouts, do not merge cells with different languages.
- ([#10004](https://github.com/quarto-dev/quarto-cli/issues/10004)): Resolve callout titles, theorem names, and `code-summary` content through `quarto_ast_pipeline()` and `process_shortcodes()`.
- ([#10196](https://github.com/quarto-dev/quarto-cli/issues/10196)): Protect against nil values in `float.caption_long`.
- ([#10328](https://github.com/quarto-dev/quarto-cli/issues/10328)): Interpret subcells as subfloats when subcap count matches subcell count.
- ([#10624](https://github.com/quarto-dev/quarto-cli/issues/10624)): Don't crash when proof environments are empty in `pdf`.
- ([#10858](https://github.com/quarto-dev/quarto-cli/issues/10858)): Don't crash in `gfm` when `content` of a `FloatRefTarget` is of type `Blocks`.
- ([#10894](https://github.com/quarto-dev/quarto-cli/issues/10894)): Fix configuration of title and prefix in callouts for `html`, `revealjs`, `pdf`, and `typst`.
- ([#10999](https://github.com/quarto-dev/quarto-cli/issues/10999)): New API entry point: `quarto.paths.rscript()` to resolve `Rscript` path in Lua filters and extensions consistently with Quarto itself.

## `dashboard` Format

- ([#10340](https://github.com/quarto-dev/quarto-cli/issues/10340)): Build card title correctly in the presence of equations and other markup.

## `html` Format

- Fix `kbd` element styling on dark themes.
- ([#10761](https://github.com/quarto-dev/quarto-cli/issues/10761)): Add support for `licence: CC0` to automatically link to Creative Commons licence [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- ([#10817](https://github.com/quarto-dev/quarto-cli/issues/10817)): Ensure that user provided SCSS has precedent over quarto generated scss also for dark theme.

## `revealjs` Format

- Update to Reveal JS 5.1.0.
  - Support for a [Jump To Slide](https://revealjs.com/jump-to-slide/) menu to quickly navigate between slides. Set `jump-to-slide: false` to opt out.
  - Support for new [Scroll View](https://revealjs.com/scroll-view/) mode with configuration through new `scroll-view` revealjs's format configuration key. A new menu tool has been added to toggle scroll view mode on and off, associated with `R` key by default.
- Prevent empty SASS built css file to be included in header.
- Remove wrong `sourceMappingUrl` entry in SASS built css.
- ([#7715](https://github.com/quarto-dev/quarto-cli/issues/7715)): Revealjs don't support anymore special Pandoc syntax making BulletList in Blockquotes become incremental list. This was confusing and unexpected behavior. Supported syntax for incremental list is documented at <https://quarto.org/docs/presentations/revealjs/#incremental-lists>.
- ([#9742](https://github.com/quarto-dev/quarto-cli/issues/9742)): Links to cross-referenced images correctly works.
- ([#9558](https://github.com/quarto-dev/quarto-cli/issues/9558)): To prevent default footer to show on slide, set `footer='false'` attribute on the slide header, e.g. `## Slide with no footer {footer='false'}`
- ([#6012](https://github.com/quarto-dev/quarto-cli/issues/6012)): Add styling for `kbd` element in Revealjs slides.
- ([#10887](https://github.com/quarto-dev/quarto-cli/issues/10887)): Updating default Mathjax used from 2.7.0 to 2.7.9.

## `typst` Format

- ([#10168](https://github.com/quarto-dev/quarto-cli/issues/10168)): Support `csl` bibliography style.
- ([#10181](https://github.com/quarto-dev/quarto-cli/issues/10181)): Remove workaround for image dimensions which is no longer necessary and mishandled image paths with spaces.
- ([#10217](https://github.com/quarto-dev/quarto-cli/issues/10217)): Explicitly compute units for image dimensions in `typst` format when they're not given.
- ([#10212](https://github.com/quarto-dev/quarto-cli/issues/10212)): Move Pandoc variables to the function declaration for the default template.
- ([#10438](https://github.com/quarto-dev/quarto-cli/issues/10438)): Ensure Pandoc doesn't emit its own crossref environments for table elements.

## `latex` and `pdf` Format

- ([#10291](https://github.com/quarto-dev/quarto-cli/issues/10291)): Several improvement regarding Quarto LaTeX engine behavior for missing hyphenation log message:
  - `latex-auto-install: false` now correctly opt out any missing hyphenation packages detection and installation. Only a warning will be thrown if any detected in the log.
  - For default behavior (`latex-auto-install: true`), detection is still happening and missing packages are installed automatically. If it fails, Quarto does not fail anymore as PDF rendering as succeeded already. Only a warning will be thrown to log the installation failure.
  - Log message about hyphenation package missing for `chinese` or `chinese-hans` languages are now ignored.
- ([#10655](https://github.com/quarto-dev/quarto-cli/issues/10655)): Missing fonts from fontspec error are correctly detected and looked for to be installed.
- ([#10891](https://github.com/quarto-dev/quarto-cli/issues/10891)): Interpret ANSI color codes in otherwise unformatted code blocks in `pdf` format.

## Projects

- ([#10268](https://github.com/quarto-dev/quarto-cli/issues/10268)): `quarto create` supports opening project in Positron, in addition to VS Code and RStudio IDE.

### Websites

- ([#10616](https://github.com/quarto-dev/quarto-cli/issues/10268)): Add a `z-index` setting to the 'back to top' button to ensure it is always visible.

### Quarto Blog

- ([#10710](https://github.com/quarto-dev/quarto-cli/issues/10710)): Fix an issue with categorie badges as links in the blog post header.

### Manuscript

- Fix an issue on Windows when creating MECA bundles containing special file name like space in the path ([quarto-ext/manuscript-template-rstudio#3](https://github.com/quarto-ext/manuscript-template-rstudio/issues/3)).

## Engines

### `julia`

- ([#10225](https://github.com/quarto-dev/quarto-cli/issues/10225)): Handle API change in `is_manifest_current` in Julia 1.11.

### `jupyter`

- ([#9134](https://github.com/quarto-dev/quarto-cli/issues/9134)): Add proper fix for `multiprocessing` in notebooks with the Python kernel.

## Other Fixes and Improvements

- Upgrade `mermaidjs` to 11.2.0.
- Upgrade Pandoc to 3.4.
- Upgrade `deno` to 1.46.3.
- ([#10162](https://github.com/quarto-dev/quarto-cli/issues/10162)): Use Edge on `macOS` as a Chromium browser when available.
- ([#10235](https://github.com/quarto-dev/quarto-cli/issues/10235)): Configure the CI schedule trigger to activate exclusively for the upstream repository.
- ([#10295](https://github.com/quarto-dev/quarto-cli/issues/10235)): Fix regression to return error status to shell when `CommandError` is thrown.
- ([#10332](https://github.com/quarto-dev/quarto-cli/issues/10332)): Use `exitWithCleanup` whenever possible instead of `Deno.exit` to clean up temporary resources.
- ([#10334](https://github.com/quarto-dev/quarto-cli/issues/10334)): Fix `author` field rendered incorrectly in dashboards when multiple authors are present.
- ([#8383](https://github.com/quarto-dev/quarto-cli/issues/8383)), ([#10087](https://github.com/quarto-dev/quarto-cli/issues/10087)), ([#10369](https://github.coma/quarto-dev/quarto-cli/issues/10369)): Track theme generation and file naming through content hashing to allow different themes to coexist in the same project.
- ([#10552](https://github.com/quarto-dev/quarto-cli/issues/10552)): Add `contents` shortcode.
- ([#10581](https://github.com/quarto-dev/quarto-cli/issues/10581)): Add `.landscape` div processing to `typst`, `docx` and `pdf` formats to support pages in landscape orientation.
- ([#10591](https://github.com/quarto-dev/quarto-cli/issues/10591)): Make fenced div syntax slightly more robust by removing spaces around the `=` sign ahead of Pandoc's reader.
- ([#10608](https://github.com/quarto-dev/quarto-cli/issues/10608)): Don't overwrite the built-in CSS function `contrast` in Quarto's SCSS.
- ([#10821](https://github.com/quarto-dev/quarto-cli/issues/10821)): Be more conservative in stripping `echo: fenced` from fenced output.
- ([#10890](https://github.com/quarto-dev/quarto-cli/issues/10890)): Don't use ports that Firefox considers unsafe.
- ([#10936](https://github.com/quarto-dev/quarto-cli/issues/10936)): Use `\\` in `meta` shortcode to escape the following character, allowing keys with `.` in them.
