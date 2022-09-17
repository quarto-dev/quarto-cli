## Jupyter

- Always ignore .ipynb inputs when they have a corresponding .qmd
- Correctly interpret cell metadata with `false` values
- Render text/latex outputs consisting entirely of $ math as markdown math
- Use IPython 7.14 import syntax in `ojs_define`
- Correct handling of multiple attachments in Jupyter Notebook classic
- Prevent overwrite of source .ipynb when output format is ipynb
- Prefer kernel declared in YAML front matter when executing notebooks
- Fix v1.1 regression in handling of cell display_data w/ Juptyer widgets

## Knitr

- Support specification of `connection` option in cell yaml options.

## OJS

- support `revealjs` and `html` formats in `width` builtin, fallback gracefully otherwise (#2058)
- Don't emit `ojs_define` HTML in non-html formats (#2338)

## Extensions

- Preview live reload for changes to extension source files
- HTML dependencies may be provided by paths to files outside the extension directory
- HTML dependencies may now include `serviceworkers`, which are copied into the output directory.
- New `quarto.doc.attachToDependency` function to attach files to html dependencies (copies files into the lib dir for a named HTML dependency).
- Ensure that `quarto.utils.dump` works with pandoc's builtin global variables (#2254)
- Provide a better error message for non-existent format resources (#2291)
- Ability to specify a minimum quarto version via the `quarto-required` option.
- Extension may now contribute project types (project metadata which will be merged with a project when project of that type are rendered)
- Include Pandoc `logging` Lua module from @wlupton
- Improve path resolution of extensions
- Add support for extensions that contribute revealjs-plugins

## Projects

- Project configuration `profile` for varying configuration and output based on global `QUARTO_PROFILE` or `--profile` command-line option.

## HTML Format

- Fix error when restoring preserved HTML in output files that use `output-file`
- Properly maintain dark/light state when navigating between pages
- Fix `code-copy` button issue when `page-layout` is full with no visible `toc` (#2388)

## PDF Format

- Provide a better error message for PDF output that produces an empty document
- Improved detection of LaTeX caption regions (#2295)
- Handle LaTeX error messages with no file output more gracefully (#2183)
- Support cross reference-able figures with callouts

## Revealjs Format

- Update to Reveal v4.3.1 (+ commit e281b32) to fix presentation scaling/zoom issues.
- Improved title slide that uses normalized author and affiliation schema
- Introduce template partials for RevealJS. You may provide partials for `title-slide.html` or `toc-slide.html`.

## GFM Format

- Support code folding for markdown output when `raw_html` is supported.

## AST Formats

- Remove intermediate metadata for AST formats (`native` and `json`)

## Google Scholar

- Properly read Google Scholar reference data from dynamically generated bibliography YML

## Crossrefs

- Fix problem with crossref indexing for listing code blocks

## Authors and Affiliations

- Improve handling of empty authors
- Parse `author` and `institute` (often used for RevealJs and Beamer) into normalized author schema

## Websites

- Properly allow `twitter-card` and `open-graph` to override the page description.
- Don't discover resources within a site or book output directory
- Enable use of custom HTML formats for websites
- Automatically populate sidebar menu using `auto` option for contents

## Books

- Fix issue that caused incomplete search indexes for books
- Don't display the book description in each chapter's title block
- book YAML now accepts fields from csl-item schema (#2148, #2398)
- book YAML now accepts date-format explicitly (#2148, #2398)

## Preview

- Restart Jupyter kernel daemon if preview server is restarted.

## Publishing

- Handle CNAME file for `gh-pages` either without or without protocol prefix (e.g. https://)

## Bibliographies and Citations

- Support formats `bibtex`, `biblatex`, and `csljson`. When rendered to one of these formats any citations within the document will be rendered as the specified bibliography format.
- Always add citeproc filter if `citeproc: true` is specified, even if there isn't a bibliography or references in the document (#2294)

## TinyTex

- `quarto install tool tinytex` will now install TinyTex even if a system installation of TeX is detected.
- `quarto install tool tinytex` will no longer add TinyTex to the system path by default.
- When rendering PDFs, Quarto will prefer an existing installation of TinyTex over a system Tex installation
- To prevent Quarto from using an installation of TinyTex (if you'd prefer the system installation be used), set `latex-tinytex: false` in your project or document front matter.
- To install TinyTex system wide, using the `--update-path` flag when installing (this will add TinyTex to the system path)

## Miscellaneous

- Render: ability to compose `--to all` with other formats (e.g. `--to all,json`)
- Don't call Deno.realPathSync on Windows (avoid problems w/ UNC paths)
- Don't include Unicode literals on Windows directly (#2184), thanks @yihui
- Improve YAML validation error messages on values of type object (#2191)
- Upgrade esbuild to 0.15.6
- Implement --help option for quarto preview and quarto run
- Increase contrast for a11y-light theme to work with default code-block background (#2067)
- Upgrade to deno 1.25.1, which should lead to a 2-3x speedup in quarto startup time
- Use deno arm64 native binaries on macOS
- Set working dir to `QUARTO_WORKING_DIR` variable if provided.
- Resolve absolute paths in include shortcodes (#2320)
- New metadata field `quarto-required` to specify required versions of quarto in a document
- Provide project configuration for calls to `quarto inspect` for files
- Improve YAML validation error messages on closed schemas (#2349)
- Don't use default width/height on mermaid diagrams when better information is available (#2383)
- Improve YAML validation error messages on invalid YAML objects that include `x = y` (#2434)
- Forward `--log-level` to Pandoc via `--trace`, `--verbose`, and `--quiet`
- Disallow names with paths in command line option `--output` and YAML option `output-file` (#2440)
