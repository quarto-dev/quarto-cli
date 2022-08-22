## Jupyter

- Daemonize jupyter notebooks referenced within listings (e.g. in a blog)
- Refine over-detection of Jupyter shell magics (which prevented kernel daemonization)
- Use on-disk cache for filtered jupyter notebooks
- Prevent error in `quarto check` when Jupyter is installed but has no Python kernel
- Don't run `ipynb-filters` for qmd source files (only run them for ipynb source files)
- More gracefully handle cell outputs with no data (don't print warning, just ignore)
- Handle non-textual data from jupyter's plain text output more robustly (#1874)
- Use IJulia's built-in conda environment / jupyter install for julia notebooks/qmds

## Knitr

- Correct handling of `knitr::include_graphics()` within inline expressions.
- Improve error message for HTML being emitted in non-HTMl formats (#1745)
- Compatibility with rgl plots (#1800, thanks @dmurdoch)

## OJS

- Better handle OJS code blocks that begin with empty lines
- Better OJS support for dark vs light mode
- Support passing Pandas Series
- Update to latest OJS runtime (adding support for latest ObservableHQ runtime)
- Fix multi-column regression (#1698)
- Hide declarations in hugo format (#1812)
- Enable OJS runtime in the presence of `ojs_define` (#1846)
- Emit subcaptions correctly (#1711)
- Use forward slashes in paths so OJS compilation works on windows (#1605)

## Pandoc

- Update to Pandoc 2.19
- Support for `embed-resources` document option
- Remove workaround for https://github.com/jgm/pandoc/issues/8099

## References

- Write additional citation metadata for compatibility with Highwire/Zotero (#1609)
- Support for `nocite` within \_project.yml for book projects (#1660)
- Improve support for Google Scholar metadata with extension to support Zotero / Highwire metadata
  (see https://quarto.org/docs/authoring/create-citeable-articles.html#citation-fields)

## Crossrefs

- Use 'Appendix' as prefix for references to chapters in appendix
- Index book crossrefs using shorter paths (fix path error seen in #1770)
- Improve handling of solution/proof content (filter headings, support code blocks)
- Insert non-breaking space between entity type (e.g. Figure/Table) and number.
- Fix crossref numbering for docx books

## Code Blocks

- Support `filename` attribute for attaching a file name header to code blocks
- Improve YAML parse error messages in `r` code blocks using `!expr` YAML (#1949)

## Tables

- Support captions in HTML tables with `df-print: paged` (#1597)
- GT tables in HTML format can be themed by quarto and follow quarto themes by default (#1834)

## Mermaid diagrams

- Support `echo: true` and other per-document settings (#1485)

## HTML Format

- Respect toc-depth in the HTML format (bootstrap) rather than always acting as if depth is 3.
- Add `group` attribute to `panel-tabset` for syncing selected tab across many tabsets
- Properly uncollapse sidebars / toc when page width elements are displayed on a page
- Properly display section numbers in the table of contents when enabled.
- Properly display banner style title blocks at mobile size.
- Improve CSS for print media formats (#1824) (thanks @hadley)
- Fix 'flickering' TOC when margin content overlays a TOC

## RevealJS Format

- Don't ignore auto stretch rules when speaker notes are present
- Target references and footnotes slides for citation and footnote links
- Automatically include chalkboard src json as a resource when publishing
- Respect styles of ordered lists (#1970)

## ePub Format

- Don't do knitr post-processing for ePub format (corrupts epub output file)

## PDF Format

- Don't include template path in the TeX search path when compiling PDFs. Use `format-resources` instead.

## Docx Format

- Don't error when code blocks appear in callouts (overly broad validation error)

## Format Templates

- Expand globs in template-partials (#1248)

## Websites

- Correctly align dark/light toggle in navbar (thanks @FabioRosado)
- Support `navbar:logo-alt` to provide alternate text for navbar logos
- Support `navbar:logo-href` to provide custom link for navbar logo & title
- Improve appearance of blog categories in title block

## Books

- Support specifying and displaying DOI for books
- Don't show chapter number in narrow HTML layouts (#1611)

## Preview

- Don't attempt to open browser when in a server session
- Respect VSCODE_PROXY_URI set by code-server

## Extensions

- Properly copy `format-resources` for HTML based formats
- Extension YAML files `_extension.yml` are now validated at render time. (#1268)
- Support boolean values in Shortcode `meta` access
- Make `quarto.base64` module available to extensions
- Support installing extensions from any GitHub tag or branch (#1836)

## Publishing

- Detect authentication error for quarto.pub and re-establish credentials
- More compact status display when running in CI environments
- Automatically detect single file publishing source within directory
- Automatically disable Netlify css/html/js asset optimization
- Respect `site-url` specified in config for GitHub Pages

## Localization

- Finnish localization (thanks @jkseppan)
- Dutch localization (thanks @bwelman)

# Installation

- Refactor configuration to make it easier to use external binaries
- Added conda-recipe (thanks @msarahan)

## Miscellaneous

- Allow environment variables to override paths to binary dependencies
- Support `cover-image-alt` to specify alt text for a book's cover image
- Correctly support Giscus `category-id` property
- Correctly support `output-file` names that contain `.` characters (like `file.name.html`)
- Avoid file permission errors in additional cases (thanks @jmbuhr)
- `QUARTO_PRINT_STACK` environment variable to print stack along with error messages
- More compact download progress when installing Quarto tools in CI environments
- Ignore case when loading date local files from `lang`
- Don't break cells incorrectly with math expressions (#1781)
- Development version cleans old vendor directory on success (https://github.com/quarto-dev/quarto-cli/pull/1863#issuecomment-1215452392)
- properly support YAML scalar syntax (#1838)
- Add support for Giscus lazy loading (use `loading: lazy` #1357)
- Properly handle duplicated affilations in author metadata (#1286)
- Display image path when an error occurs reading PNG metadata
- `quarto run *.ts` preserves stdout and stderr (#1954)
- Lua filters: quarto.utils.dump does not loop on circular structures (#1958)
