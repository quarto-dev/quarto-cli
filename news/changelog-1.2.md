## Jupyter

- Always ignore .ipynb inputs when they have a corresponding .qmd
- Correctly interpret cell metadata with `false` values
- Render text/latex outputs consisting entirely of $ math as markdown math
- Use IPython 7.14 import syntax in `ojs_define`

## OJS

- support `revealjs` and `html` formats in `width` builtin, fallback gracefully otherwise (#2058)

## Extensions

- HTML dependencies may be provided by paths to files outside the extension directory

## HTML Format

- Fix error when restoring preserved HTML in output files that use `output-file`

## PDF Format

- Provide a better error message for PDF output that produces an empty document

## Authors and Affiliations

- Improve handling of empty authors

## Websites

- Properly allow `twitter-card` and `open-graph` to override the page description.
- Don't discover resources within a site or book output directory

## Publishing

- Handle CNAME file for `gh-pages` either without or without protocol prefix (e.g. https://)

## Bibliographies

- Support formats `bibtex`, `biblatex`, and `csljson`. When rendered to one of these formats any citations within the document will be rendered as the specified bibliography format.

## Lua Filters

- Harden `quarto.utils.dump` so it works with pandoc's builtin global variables (#2254)

## Miscellaneous

- Don't call Deno.realPathSync on Windows (avoid problems w/ UNC paths)
- Don't include Unicode literals on Windows directly (#2184), thanks @yihui
- Improve YAML validation error messages on values of type object (#2191)
- Upgrade esbuild to 0.15.6
- Implement --help option for quarto preview and quarto run
- Increase contrast for a11y-light theme to work with default code-block background (#2067)
- Upgrade to deno 1.25.1, which should lead to a 2-3x speedup in quarto startup time
- Use arm64 native binaries on Mac
