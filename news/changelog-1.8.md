# v1.9 backports

## In this release

## In previous releases

- ([#13694](https://github.com/quarto-dev/quarto-cli/issues/13694)): Fix `notebook-view.url` being ignored - external notebook links now properly use specified URLs instead of local preview files.
- ([#13732](https://github.com/quarto-dev/quarto-cli/issues/13732)): Fix automatic font package installation for fonts with spaces in their names (e.g., "Noto Emoji", "DejaVu Sans"). Font file search patterns now match both with and without spaces.
- ([#13369](https://github.com/quarto-dev/quarto-cli/issues/13369)): Fix failure in theme compilation when `brand.color.primary` is specified for light or dark but not both.
- ([#13383](https://github.com/quarto-dev/quarto-cli/issues/13383)): Fix failure when combining `minimal: true` with brand.yml.
- ([#13396](https://github.com/quarto-dev/quarto-cli/issues/13396)): Fix `quarto publish connect` regression.
- ([#13418](https://github.com/quarto-dev/quarto-cli/issues/13418)): Resolve logo paths specified directly in `brand.logo.{size}`.
- ([#13445](https://github.com/quarto-dev/quarto-cli/pull/13445)): Brand logo shortcode will not add `.light-content`, `.dark-content` classes when `light` or `dark` is specifically requested.
- ([#13046](https://github.com/quarto-dev/quarto-cli/issues/13046)): Use new url for multiplex socket.io server <https://multiplex.up.railway.app/> as default for `format: revealjs` and `revealjs.multiplex: true`.
- ([#13506](https://github.com/quarto-dev/quarto-cli/issues/13506)): Fix navbar active state detection when sidebar has no logo configured. Prevents empty logo links from interfering with navigation highlighting.
- ([#13616](https://github.com/quarto-dev/quarto-cli/issues/13616)): Fix fatal error when rendering manuscript projects with custom blocks like ConditionalBlock.
- ([#13625](https://github.com/quarto-dev/quarto-cli/issues/13625)): Fix Windows file locking error (os error 32) when rendering with `--output-dir` flag. Context cleanup now happens before removing the temporary `.quarto` directory, ensuring file handles are properly closed.
- ([#13633](https://github.com/quarto-dev/quarto-cli/issues/13633)): Fix detection and auto-installation of babel language packages from newer error format that doesn't explicitly mention `.ldf` filename.

# v1.8 changes

## Regression fixes

- ([#6607](https://github.com/quarto-dev/quarto-cli/issues/6607)): Add missing beamer template update for beamer theme options: `colorthemeoptions`, `fontthemeoptions`, `innerthemeoptions` and `outerthemeoptions`.
- ([#12625](https://github.com/quarto-dev/quarto-cli/pull/12625)): Fire resize event on window when light/dark toggle is clicked, to tell widgets to resize.
- ([#12657](https://github.com/quarto-dev/quarto-cli/pull/12657)): Load Giscus in generated script tag, to avoid wrong-theming in Chrome.
- ([#12780](https://github.com/quarto-dev/quarto-cli/issues/12780)): `keep-ipynb: true` now works again correctly and intermediate `.quarto_ipynb` is not removed.
- ([#13051](https://github.com/quarto-dev/quarto-cli/issues/13051)): Fixed support for captioned Markdown table inside Div syntax for crossref. This is special handling, but this could be output by function like `knitr::kable()` with old option support.
- ([#13441](https://github.com/quarto-dev/quarto-cli/pull/13441)): Catch `undefined` exceptions in Pandoc failure to avoid spurious error message.
- ([#13456](https://github.com/quarto-dev/quarto-cli/pull/13456)): Ensure that the `axe` YAML completion only appears in HTML formats.

## Backwards-compatibility breaking changes

- ([#13104](https://github.com/quarto-dev/quarto-cli/issues/13104)): Remove `posit-cloud` as `quarto publish` destination. See <https://docs.posit.co/cloud/whats_new/#october-2024> for details.

## Dependencies

- Update `bootstrap-icons` to version v1.13.1 from v1.11.1.

## Formats

### `html`

- ([#678](https://github.com/quarto-dev/quarto-cli/issues/678)): a11y - Provide appropriate `aria-label` to search button.
- ([#726](https://github.com/quarto-dev/quarto-cli/issues/726)): a11y - Provide `.screen-reader-only` callout type when callout text doesn't naturally include the type.
- ([#5538](https://github.com/quarto-dev/quarto-cli/issues/5538)): Fix code-copy button style so that scrolling behaves properly.
- ([#5879](https://github.com/quarto-dev/quarto-cli/issues/5879)): Improve font rendering of `kbd` shortcode on macOS. `kbd` will now also be stricter in converting keyboard shortcuts to macOS icons.
- ([#8568](https://github.com/quarto-dev/quarto-cli/issues/8568)) Default inline code background color to the code block background color if not specified; foreground color is `$pre-color` in dark mode and (remains) purple in light mode.
- ([#10983](https://github.com/quarto-dev/quarto-cli/issues/10983)): Fix spacing inconsistency between paras and first section headings.
- ([#11982](https://github.com/quarto-dev/quarto-cli/issues/11982)): Ensure brand.yml logos are resolved correctly when document is in a subdirectory.
- ([#12259](https://github.com/quarto-dev/quarto-cli/issues/12259)): Fix conflict between `html-math-method: katex` and crossref popups (author: @benkeks).
- ([#12341](https://github.com/quarto-dev/quarto-cli/issues/12341)): Enable light and dark logos for html formats (sidebar, navbar, dashboard).
- ([#12501](https://github.com/quarto-dev/quarto-cli/issues/12501)): Enable `source: file` for `brand.yml` fonts in HTML.
- ([#12643](https://github.com/quarto-dev/quarto-cli/issues/12643)): Ensure brand.yml logos using urls are rendered correctly by passing them through when resolving brand `processedData`, and not processing them as paths.
- ([#12734](https://github.com/quarto-dev/quarto-cli/issues/12734)): `highlight-style` now correctly supports setting a different `light` and `dark`.
- ([#12747](https://github.com/quarto-dev/quarto-cli/issues/12747)): Ensure `th` elements are properly restored when Quarto's HTML table processing is happening.
- ([#12766](https://github.com/quarto-dev/quarto-cli/issues/12766)): Use consistent equation numbering display for `html-math-method` and `html-math-method.method` for MathJax and KaTeX (author: @mcanouil)
- ([#12797](https://github.com/quarto-dev/quarto-cli/issues/12797)): Allow light and dark brands to be specified in one file, by specializing colors with `light:` and `dark:`.
- ([#12919](https://github.com/quarto-dev/quarto-cli/issues/12919)): Ensure `kbd` shortcode output has hover tooltip.
- ([#12981](https://github.com/quarto-dev/quarto-cli/issues/12981)): Brand should be applied in dark mode when dark mode is enabled by the theme, not the brand.
- ([#13004](https://github.com/quarto-dev/quarto-cli/issues/13004)): Brand logo shortcode automatically applies `.light-content` and `.dark-content` classes, inserts both light and dark logo if brand mode is not specified, and uses alt text from brand logo spec.

### `revealjs`

- ([#10933](https://github.com/quarto-dev/quarto-cli/issues/10933)): Revealjs supports alt text on logo, as well as customization of light and dark logos at the document level, consistent with other formats.
- ([#12550](https://github.com/quarto-dev/quarto-cli/issues/12550)): Revealjs supports `brand-mode`, allowing to select either the light or the dark brand.
- ([#12598](https://github.com/quarto-dev/quarto-cli/pull/12598)): Ensure `.fragment` on an image with caption applies to whole figure.
- ([#12716](https://github.com/quarto-dev/quarto-cli/issues/12716)): Correctly resolve `"brand"` set in `theme` configuration for document in subdirectory from project root.
- Use `cdn.jsdelivr.net` for mathjax dependencies to ensure consistent CDN usage across formats. Previously, `cdnjs.cloudflare.com` was used for `revealjs` mathjax dependencies, while `cdn.jsdelivr.net` was used for html format.
- [#13316](https://github.com/quarto-dev/quarto-cli/issues/13316): `code-line-numbers: "1"` correctly highlight the first line now.

### `docx`

- ([#8392](https://github.com/quarto-dev/quarto-cli/issues/8392)): Fix `docx` generation issues in tables

### `typst`

- ([#12180](https://github.com/quarto-dev/quarto-cli/issues/12180)): Typst schema / autocomplete for `logo` option has `path` and `alt`.
- ([#12554](https://github.com/quarto-dev/quarto-cli/pull/12554)): CSS properties `font-weight` and `font-style` are translated to Typst `text` properties.
- ([#12695](https://github.com/quarto-dev/quarto-cli/issues/12695)): Resolve Typst `font-paths` that start with `/` relative to project root.
- ([#12739](https://github.com/quarto-dev/quarto-cli/pull/12739)): Remove unused variable `heading-background-color` and `heading-decoration` from Typst's templates. They are leftover from previous change, and not part of Brand.yml schema for typography of headings.
- ([#12815](https://github.com/quarto-dev/quarto-cli/issues/12815)): Do not crash when floats have no content.
- ([#13119](https://github.com/quarto-dev/quarto-cli/pull/13119)): Expose `brand.logo` metadata as Typst dictionaries.
- ([#13133](https://github.com/quarto-dev/quarto-cli/pull/13133)): Allow customization of light and dark logos at document level, consistent with other formats.
- ([#13297](https://github.com/quarto-dev/quarto-cli/pull/13297)): Ensure brand.yml logos are resolved correctly when Typst document is in a subdirectory.

### `beamer`

- ([#12775](https://github.com/quarto-dev/quarto-cli/issues/12775)): Convert Quarto-native layouts (divs with `layout` syntax) to Beamer columns, equivalent to using the Pandoc-native syntax of div with `columns` and `column` classes.

### `pdf`

- ([#12732](https://github.com/quarto-dev/quarto-cli/issues/12732)): Correctly detect missing definition files in multiline babel error for search package to auto-install.

### `hugo-md`

- ([#12676](https://github.com/quarto-dev/quarto-cli/issues/12676)): Add support for rendering layout panels that are not floats.

### `docusaurus-md`

- [#13316](https://github.com/quarto-dev/quarto-cli/issues/13316): `code-line-numbers: "1"` correctly highlight the first line now.

### `markdown` formats

- ([#12630])(https://github.com/quarto-dev/quarto-cli/issues/12630)): emit image element for `video` shortcodes targeting local videos.

## Projects

### `website`

- ([#10284](https://github.com/quarto-dev/quarto-cli/issues/10284)): a11y - Fix keyboard navigation for tabset panels when using an HTML theme. Tabs now properly receive keyboard focus.
- ([#12551](https://github.com/quarto-dev/quarto-cli/pull/12551)): Improve warning issued when `aliases` would overwrite an existing document.
- ([#12616](https://github.com/quarto-dev/quarto-cli/issues/12616)): find SVG images in image discovery for listings.
- ([#12693](https://github.com/quarto-dev/quarto-cli/issues/12693)): Prevent resource exhaustion on large websites by serializing `NotebookContext` information to file instead of the environment.
- ([#12949](https://github.com/quarto-dev/quarto-cli/issues/12949)): Ensure redirects preserve `hash` and `search` when possible.

## Crossrefs

- ([#12615](https://github.com/quarto-dev/quarto-cli/pull/12615)): Adds `algorithm` to theorem environments. (author: @jeremy9959)

## Lua Filters and API

- ([#11750](https://github.com/quarto-dev/quarto-cli/pull/11750)): Extend filter path resolution to support `at`/`path` filters from extensions.
- ([#12727](https://github.com/quarto-dev/quarto-cli/issues/12727)): Do not crash in the presence of malformed tabset contents.
- ([#12806](https://github.com/quarto-dev/quarto-cli/pull/12806)): Use pandoc APIs to handle codepage conversion on Windows.
- ([#12811](https://github.com/quarto-dev/quarto-cli/pull/12811)): Add support for YouTube Shorts in `video` shortcode.
- ([#13112](https://github.com/quarto-dev/quarto-cli/pull/13112)): Add `quarto.format.format_identifier()` API entry.
- ([#13128](https://github.com/quarto-dev/quarto-cli/issues/13128)): Avoid meta shortcode crash on bad input.
- ([#13246](https://github.com/quarto-dev/quarto-cli/pull/13246)): Add `quarto.variables.get()` and `quarto.metadata.get()` APIs.
- ([#13334](https://github.com/quarto-dev/quarto-cli/issues/13334)): Fix wrong function being called on `is_html_slide_output` and `is_markdown_with_html_output`.

## Commands

### `inspect`

- ([#12733](https://github.com/quarto-dev/quarto-cli/issues/12733)): Add installed extensions to `quarto inspect` project report.

### `add`

- ([#12627](https://github.com/quarto-dev/quarto-cli/issues/12627)): Don't actually install extension when user responds `yes` to first prompt but `no` to second.

### `create`

- ([#12965](https://github.com/quarto-dev/quarto-cli/issues/12965)): Prevent automatic opening of new editor sessions when creating projects in Posit Workbench context. The `--open` flag is now ignored in this environment to avoid issues with Workbench session management.

## Extensions

- ([#12559](https://github.com/quarto-dev/quarto-cli/issues/12559)): New extension type: `brand` for distributing [brand.yml](https://posit-dev.github.io/brand-yml/) configurations with associated assets.

## Engines

- ([#13171](https://github.com/quarto-dev/quarto-cli/pull/13171/)): Provide execution information to all engines uniformly via QUARTO_EXECUTE_INFO environment variable. It points to a file on disk containing a JSON object describing the execution environment for code cells to use.

### `jupyter`

- ([#12753](https://github.com/quarto-dev/quarto-cli/issues/12753)): Support change in IPython 9+ and import `set_matplotlib_formats` from `matplotlib_inline.backend_inline` in the internal `setup.py` script used to initialize rendering with Jupyter engine.
- ([#12839](https://github.com/quarto-dev/quarto-cli/issues/12839)): Support for `plotly.py` 6+ which now loads plotly.js using a cdn in script as a module.
- ([#13026](https://github.com/quarto-dev/quarto-cli/pull/13026), [#13151](https://github.com/quarto-dev/quarto-cli/pull/13151)), [#13184](https://github.com/quarto-dev/quarto-cli/pull/13184): Use `jsdelivr` CDN for jupyter widgets dependencies.

### `knitr`

- Correctly detect R binary on Windows when `R_HOME` is set - this fixes issue with `quarto::quarto_render()` that will now correctly use the same R version as the R session it is called from.

### `julia`

- ([#12870](https://github.com/quarto-dev/quarto-cli/pull/12870)): Update `julia` engine from `0.17.0` to `0.17.3` to improve `juliaup` detection on Windows systems and correctly set `Base.source_path()` output to match REPL and script usage.

## Languages

- ([#13098](https://github.com/quarto-dev/quarto-cli/pull/13098)): Fox a minor inappropriate phrasing in the Chinese localization of `environment-proof-title` (@sun123xyz).

## Other fixes and improvements

- ([#11321](https://github.com/quarto-dev/quarto-cli/issues/11321)): Follow [recommendation from LaTeX project](https://latex-project.org/news/latex2e-news/ltnews40.pdf) and use `lualatex` instead of `xelatex` as the default PDF engine.
- ([#12782](https://github.com/quarto-dev/quarto-cli/pull/12782)): fix bug on `safeRemoveDirSync`'s detection of safe directory boundaries.
- ([#12853](https://github.com/quarto-dev/quarto-cli/issues/12853)): fix replaceAll() escaping issue with embedded notebooks containing `$` in their Markdown.
- ([#12939](https://github.com/quarto-dev/quarto-cli/pull/12939)): Upgrade `mermaidjs` to 11.6.0.
- ([#13031](https://github.com/quarto-dev/quarto-cli/pull/13031)): Add `.quarto_ipynb` files to `.gitignore` by default.
- ([#13085](https://github.com/quarto-dev/quarto-cli/pull/13085)): Avoid `kbd` shortcode crashes on unknown OS keys.
- ([#13164](https://github.com/quarto-dev/quarto-cli/pull/13164)): add `julia` to execute schema to allow autocomplete suggestions. (@mcanouil)
- ([#13121](https://github.com/quarto-dev/quarto-cli/issues/13121)): Allow `contents` shortcode to find inline elements.
- ([#13216](https://github.com/quarto-dev/quarto-cli/issues/13216)): Properly disable `downlit` (`code-link`) and enable `code-annotations` when non-R code blocks are present.

## Quarto Internals

- ([#13155](https://github.com/quarto-dev/quarto-cli/pull/13155)): Process `pandoc-reader-FORMAT` raw blocks through `pandoc.read(FORMAT)`.
- ([#13255](https://github.com/quarto-dev/quarto-cli/pull/13255)): Move some Lua code to use Pandoc's Lua API.
