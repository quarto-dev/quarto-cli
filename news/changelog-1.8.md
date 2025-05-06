All changes included in 1.8:

## Formats

### `revealjs`

- ([#12598](https://github.com/quarto-dev/quarto-cli/pull/12598)): Ensure `.fragment` on an image with caption applies to whole figure.

### `docx`

- ([#8392](https://github.com/quarto-dev/quarto-cli/issues/8392)): Fix `docx` generation issues in tables 

## Projects

### `website`

- ([#12551](https://github.com/quarto-dev/quarto-cli/pull/12551)): Improve warning issued when `aliases` would overwrite an existing document.
- ([#12616](https://github.com/quarto-dev/quarto-cli/issues/12616)): find SVG images in image discovery for listings.
- ([#12693](https://github.com/quarto-dev/quarto-cli/issues/12693)): Prevent resource exhaustion on large websites by serializing `NotebookContext` information to file instead of the environment.

## Crossrefs

- ([#12615](https://github.com/quarto-dev/quarto-cli/pull/12615)): Adds `algorithm` to theorem environments. (author: @jeremy9959)
