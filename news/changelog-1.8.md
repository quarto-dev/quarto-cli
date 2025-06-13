All changes included in 1.8:

## Regression fixes

- ([#6607](https://github.com/quarto-dev/quarto-cli/issues/6607)): Add missing beamer template update for beamer theme options: `colorthemeoptions`, `fontthemeoptions`, `innerthemeoptions` and `outerthemeoptions`.
- ([#12625](https://github.com/quarto-dev/quarto-cli/pull/12625)): Fire resize event on window when light/dark toggle is clicked, to tell widgets to resize.
- ([#12657](https://github.com/quarto-dev/quarto-cli/pull/12657)): Load Giscus in generated script tag, to avoid wrong-theming in Chrome.
- ([#12780](https://github.com/quarto-dev/quarto-cli/issues/12780)): `keep-ipynb: true` now works again correctly and intermediate `.quarto_ipynb` is not removed.

## Formats

### `html`

- ([#678](https://github.com/quarto-dev/quarto-cli/issues/678)): a11y - Provide appropriate `aria-label` to search button.
- ([#726](https://github.com/quarto-dev/quarto-cli/issues/726)): a11y - Provide `.screen-reader-only` callout type when callout text doesn't naturally include the type.
- ([#5538](https://github.com/quarto-dev/quarto-cli/issues/5538)): Fix code-copy button style so that scrolling behaves properly.
- ([#10983](https://github.com/quarto-dev/quarto-cli/issues/10983)): Fix spacing inconsistency between paras and first section headings.
- ([#12259](https://github.com/quarto-dev/quarto-cli/issues/12259)): Fix conflict between `html-math-method: katex` and crossref popups (author: @benkeks).
- ([#12734](https://github.com/quarto-dev/quarto-cli/issues/12734)): `highlight-style` now correctly supports setting a different `light` and `dark`.
- ([#12747](https://github.com/quarto-dev/quarto-cli/issues/12747)): Ensure `th` elements are properly restored when Quarto's HTML table processing is happening.
- ([#12766](https://github.com/quarto-dev/quarto-cli/issues/12766)): Use consistent equation numbering display for `html-math-method` and `html-math-method.method` for MathJax and KaTeX (author: @mcanouil)
- ([#12797](https://github.com/quarto-dev/quarto-cli/issues/12797)): Allow light and dark brands to be specified in one file, by specializing colors with `light:` and `dark:`.

### `revealjs`

- ([#12598](https://github.com/quarto-dev/quarto-cli/pull/12598)): Ensure `.fragment` on an image with caption applies to whole figure.

### `docx`

- ([#8392](https://github.com/quarto-dev/quarto-cli/issues/8392)): Fix `docx` generation issues in tables

### `typst`

- ([#12554](https://github.com/quarto-dev/quarto-cli/pull/12554)): CSS properties `font-weight` and `font-style` are translated to Typst `text` properties.
- ([#12695](https://github.com/quarto-dev/quarto-cli/issues/12695)): Resolve Typst `font-paths` that start with `/` relative to project root.
- ([#12739](https://github.com/quarto-dev/quarto-cli/pull/12739)): Remove unused variable `heading-background-color` and `heading-decoration` from Typst's templates. They are leftover from previous change, and not part of Brand.yml schema for typography of headings.
- ([#12815](https://github.com/quarto-dev/quarto-cli/issues/12815)): Do not crash when floats have no content.

### `beamer`

- ([#12775](https://github.com/quarto-dev/quarto-cli/issues/12775)): Convert Quarto-native layouts (divs with `layout` syntax) to Beamer columns, equivalent to using the Pandoc-native syntax of div with `columns` and `column` classes.

### `hugo-md`

- ([#12676](https://github.com/quarto-dev/quarto-cli/issues/12676)): Add support for rendering layout panels that are not floats.

## Projects

### `website`

- ([#12551](https://github.com/quarto-dev/quarto-cli/pull/12551)): Improve warning issued when `aliases` would overwrite an existing document.
- ([#12616](https://github.com/quarto-dev/quarto-cli/issues/12616)): find SVG images in image discovery for listings.
- ([#12693](https://github.com/quarto-dev/quarto-cli/issues/12693)): Prevent resource exhaustion on large websites by serializing `NotebookContext` information to file instead of the environment.

## Crossrefs

- ([#12615](https://github.com/quarto-dev/quarto-cli/pull/12615)): Adds `algorithm` to theorem environments. (author: @jeremy9959)

## Lua Filters

- ([#12727](https://github.com/quarto-dev/quarto-cli/issues/12727)): Do not crash in the presence of malformed tabset contents.
- ([#12806](https://github.com/quarto-dev/quarto-cli/pull/12806)): Use pandoc APIs to handle codepage conversion on Windows.
- ([#12811](https://github.com/quarto-dev/quarto-cli/pull/12811)): Add support for YouTube Shorts in `video` shortcode.

## Commands

### `inspect`

- ([#12733](https://github.com/quarto-dev/quarto-cli/issues/12733)): Add installed extensions to `quarto inspect` project report.

### `add`

- ([#12627](https://github.com/quarto-dev/quarto-cli/issues/12627)): Don't actually install extension when user responds `yes` to first prompt but `no` to second.

## Engines

### `jupyter`

- ([#12753](https://github.com/quarto-dev/quarto-cli/issues/12753)): Support change in IPython 9+ and import `set_matplotlib_formats` from `matplotlib_inline.backend_inline` in the internal `setup.py` script used to initialize rendering with Jupyter engine.
- ([#12839](https://github.com/quarto-dev/quarto-cli/issues/12839)): Support for `plotly.py` 6+ which now loads plotly.js using a cdn in script as a module.

### `knitr`

- Correctly detect R binary on Windows when `R_HOME` is set - this fixes issue with `quarto::quarto_render()` that will now correctly use the same R version as the R session it is called from.

### `julia`

- ([#12870](https://github.com/quarto-dev/quarto-cli/pull/12870)): Update `julia` engine from `0.17.0` to `0.17.3` to improve `juliaup` detection on Windows systems and correctly set `Base.source_path()` output to match REPL and script usage.

## Other fixes and improvements

- ([#11321](https://github.com/quarto-dev/quarto-cli/issues/11321)): Follow [recommendation from LaTeX project](https://latex-project.org/news/latex2e-news/ltnews40.pdf) and use `lualatex` instead of `xelatex` as the default PDF engine.
- ([#12782](https://github.com/quarto-dev/quarto-cli/pull/12782)): fix bug on `safeRemoveDirSync`'s detection of safe directory boundaries.
- ([#12853](https://github.com/quarto-dev/quarto-cli/issues/12853)): fix replaceAll() escaping issue with embedded notebooks containing `$` in their Markdown.