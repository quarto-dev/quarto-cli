## OJS

- support `revealjs` and `html` formats in `width` builtin, fallback gracefully otherwise (#2058)

## Jupyter

- Always ignore .ipynb inputs when they have a corresponding .qmd
- Correctly interpret cell metadata with `false` values
- Render text/latex outputs consisting entirely of $ math as markdown math

## General

- Don't discover resources within a site or book output directory
- Fix error when restoring preserved HTML in output files that use `output-file`
- Don't call Deno.realPathSync on Windows (avoid problems w/ UNC paths)
- Don't include Unicode literals on Windows directly (#2184), thanks @yihui
- Improve YAML validation error messages on values of type object (#2191)
- Upgrade esbuild to 0.15.6

## PDF Output

- Provide a better error message for PDF output that produces an empty document

## Authors and Affiliations

- Improve handling of empty authors

## Websites

- Properly allow `twitter-card` and `open-graph` to override the page description.

## Publishing

- Handle CNAME file for `gh-pages` either without or without protocol prefix (e.g. https://)

## Bibliography output

- Now support formats `bibtex`, `biblatex`, and `csljson`. When rendered to one of these formats any citations within the document will be rendered as the specified bibliography format.
