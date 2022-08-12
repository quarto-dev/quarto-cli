## Jupyter

- Daemonize jupyter notebooks referenced within listings (e.g. in a blog)
- Refine over-detection of Jupyter shell magics (which prevented kernel daemonization)
- Use on-disk cache for filtered jupyter notebooks

## Knitr

- Correct handling of `knitr::include_graphics()` within inline expressions.
- Improve error message for HTML being emitted in non-HTMl formats (#1745)

## Pandoc

- Update to Pandoc 2.19
- Support for `embed-resources` document option

## References

- Write additional citation metadata for compatibility with Highwire/Zotero (#1609)
- Support for `nocite` within \_project.yml for book projects (#1660)
- Improve support for Google Scholar metadata with extension to support Zotero / Highwire metadata (see https://quarto.org/docs/authoring/create-citeable-articles.html#citation-fields)

## Crossrefs

- Use 'Appendix' as prefix for references to chapters in appendix
- Index book crossrefs using shorter paths (fix path error seen in #1770)

## Code Blocks

- Support `filename` attribute for attaching a file name header to code blocks

## OJS

- Better handle OJS code blocks that begin with empty lines
- Better OJS support for dark vs light mode
- Support passing Pandas Series
- Update to latest OJS runtime (adding support for latest ObservableHQ runtime)
- Fix multi-column regression (#1698)
- hide declarations in hugo format (#1812)
- enable OJS runtime in the presence of `ojs_define` (#1846)

## Websites

- Correctly align dark/light toggle in navbar (thanks @FabioRosado)
- Support `navbar:logo-alt` to provide alternate text for navbar logos
- Support `navbar:logo-href` to provide custom link for navbar logo & title

## Books

- Support specifying and displaying DOI for books
- Don't show chapter number in narrow HTML layouts (#1611)

## Preview

- Don't attempt to open browser when in a server session

## Localization

- Finnish localization (thanks @jkseppan)
- Dutch localization (thanks @bwelman)

## HTML Format

- Respect toc-depth in the HTML format (bootstrap) rather than always acting as if depth is 3.
- Add `group` attribute to `panel-tabset` for syncing selected tab across many tabsets
- Properly uncollapse sidebars / toc when page width elements are displayed on a page

## RevealJS Format

- Don't ignore auto stretch rules when speaker notes are present
- Target references and footnotes slides for citation and footnote links

## Mermaid diagrams

- support `echo: true` and other per-document settings (#1485)

## Extensions

- Properly copy `format-resources` for HTML based formats
- Extension YAML files `_extension.yml` are now validated at render time. (#1268)

## Publishing

- Detect authentication error for quarto.pub and re-establish credentials
- More compact status display when running in CI environments

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

## Format Templates

- expand globs in template-partials (#1248)

## Tables

- support captions in HTML tables with `df-print: paged` (#1597)
- GT tables in HTML format can be themed by quarto and follow quarto themes by default (#1834)
