All changes included in 1.8:

## Regression fixes

- ([#6607](https://github.com/quarto-dev/quarto-cli/issues/6607)): Add missing beamer template update for beamer theme options: `colorthemeoptions`, `fontthemeoptions`, `innerthemeoptions` and `outerthemeoptions`.
- ([#12625](https://github.com/quarto-dev/quarto-cli/pull/12625)): Fire resize event on window when light/dark toggle is clicked, to tell widgets to resize.
- ([#12657](https://github.com/quarto-dev/quarto-cli/pull/12657)): Load Giscus in generated script tag, to avoid wrong-theming in Chrome.

## Formats

### `html`

- ([#12259](https://github.com/quarto-dev/quarto-cli/issues/12259)): Fix conflict between `html-math-method: katex` and crossref popups (author: @benkeks).
- ([#12734](https://github.com/quarto-dev/quarto-cli/issues/12734)): `highlight-style` now correctly supports setting a different `light` and `dark`.

### `revealjs`

- ([#12598](https://github.com/quarto-dev/quarto-cli/pull/12598)): Ensure `.fragment` on an image with caption applies to whole figure.

### `docx`

- ([#8392](https://github.com/quarto-dev/quarto-cli/issues/8392)): Fix `docx` generation issues in tables

### `typst`

- ([#12554](https://github.com/quarto-dev/quarto-cli/pull/12554)): CSS properties `font-weight` and `font-style` are translated to Typst `text` properties.

## Projects

### `website`

- ([#12551](https://github.com/quarto-dev/quarto-cli/pull/12551)): Improve warning issued when `aliases` would overwrite an existing document.
- ([#12616](https://github.com/quarto-dev/quarto-cli/issues/12616)): find SVG images in image discovery for listings.
- ([#12693](https://github.com/quarto-dev/quarto-cli/issues/12693)): Prevent resource exhaustion on large websites by serializing `NotebookContext` information to file instead of the environment.

## Crossrefs

- ([#12615](https://github.com/quarto-dev/quarto-cli/pull/12615)): Adds `algorithm` to theorem environments. (author: @jeremy9959)
