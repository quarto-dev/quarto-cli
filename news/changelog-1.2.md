## Jupyter

- Always ignore .ipynb inputs when they have a corresponding .qmd
- Correctly interpret cell metadata with `false` values
- Render text/latex outputs consisting entirely of $ math as markdown math
- Use IPython 7.14 import syntax in `ojs_define`

## OJS

- support `revealjs` and `html` formats in `width` builtin, fallback gracefully otherwise (#2058)

## Extensions

- Preview live reload for changes to extension source files
- HTML dependencies may be provided by paths to files outside the extension directory
- HTML dependencies may now include `serviceworkers`, which are copied into the output directory.
- New `quarto.doc.attachToDependency` function to attach files to html dependencies (copies files into the lib dir for a named HTML dependency).
- Ensure that `quarto.utils.dump` works with pandoc's builtin global variables (#2254)
- Provide a better error message for non-existent format resources (#2291)

## HTML Format

- Fix error when restoring preserved HTML in output files that use `output-file`
- Properly maintain dark/light state when navigating between pages

## PDF Format

- Provide a better error message for PDF output that produces an empty document

## Authors and Affiliations

- Improve handling of empty authors

## Websites

- Properly allow `twitter-card` and `open-graph` to override the page description.
- Don't discover resources within a site or book output directory
- Enable use of custom HTML formats for websites
- Automatically populate sidebar menu using `auto` option for contents

## Books

- Fix issue that caused incomplete search indexes for books
- Don't display the book description in each chapter's title block

## Publishing

- Handle CNAME file for `gh-pages` either without or without protocol prefix (e.g. https://)

## Bibliographies

- Support formats `bibtex`, `biblatex`, and `csljson`. When rendered to one of these formats any citations within the document will be rendered as the specified bibliography format.

## Miscellaneous

- Don't call Deno.realPathSync on Windows (avoid problems w/ UNC paths)
- Don't include Unicode literals on Windows directly (#2184), thanks @yihui
- Improve YAML validation error messages on values of type object (#2191)
- Upgrade esbuild to 0.15.6
- Implement --help option for quarto preview and quarto run
- Increase contrast for a11y-light theme to work with default code-block background (#2067)
- Upgrade to deno 1.25.1, which should lead to a 2-3x speedup in quarto startup time
- Use deno arm64 native binaries on macOS
- Set working dir to `QUARTO_WORKING_DIR` variable if provided.
