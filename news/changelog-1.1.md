## Jupyter

- Daemonize jupyter notebooks referenced within listings (e.g. in a blog)
- Refine over-detection of Jupyter shell magics (which prevented kernel daemonization)
- Use on-disk cache for filtered jupyter notebooks

## Knitr

- Correct handling of `knitr::include_graphics()` within inline expressions.

## Pandoc

- Update to Pandoc 2.19
- Support for `embed-resources` document option

## References

- Write additional citation metadata for compatibility with Highwire/Zotero (#1609)
- Support for `nocite` within \_project.yml for book projects (#1660)

## Crossrefs

- Use 'Appendix' as prefix for references to chapters in appendix

## Code Blocks

- Support `filename` attribute for attaching a file name header to code blocks

## OJS

- Better handle OJS code blocks that begin with empty lines
- Better OJS support for dark vs light mode
- Support passing Pandas Series
- Update to latest OJS runtime
- Fix multi-column regression (#1698)

## Websites

- Correctly align dark/light toggle in navbar (thanks @FabioRosado)

## Preview

- Don't attempt to open browser when in a server session

## Localization

- Finnish localization (thanks @jkseppan)
- Dutch localization (thanks @bwelman)

## HTML Format

- Respect toc-depth in the HTML format (bootstrap) rather than always acting as if depth is 3.
- Add `group` attribute to `panel-tabset` for syncing selected tab across many tabsets

## RevealJS Format

- Don't ignore auto stretch rules when speaker notes are present
- Target references and footnotes slides for citation and footnote links

## Mermaid diagrams

- support `echo: true` and other per-document settings (#1485)

## Publishing

- Detect authentication error for quarto.pub and re-establish credentials

## Miscellaneous

- Allow environment variables to override paths to binary dependencies
- Support `cover-image-alt` to specify alt text for a book's cover image
- Correctly support Giscus `category-id` property
- Correctly support `output-file` names that contain `.` characters (like `file.name.html`)
- Avoid file permission errors in additional cases (thanks @jmbuhr)
- `QUARTO_PRINT_STACK` environment variable to print stack along with error messages
