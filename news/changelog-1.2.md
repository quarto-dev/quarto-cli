## OJS

- support `revealjs` and `html` formats in `width` builtin, fallback gracefully otherwise (#2058)

## Jupyter

- Always ignore .ipynb inputs when they have a corresponding .qmd
- Correctly interpret cell metadata with `false` values

## General

- Don't discover resources within a site or book output directory
- Fix error when restoring preserved HTML in output files that use `output-file`
- Don't call Deno.realPathSync on Windows (avoid problems w/ UNC paths)
