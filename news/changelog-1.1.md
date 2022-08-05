## Jupyter

- Daemonize jupyter notebooks referenced within listings (e.g. in a blog)
- Refine over-detection of Jupyter shell magics (which prevented kernel daemonization)
- Use on-disk cache for filtered jupyter notebooks

## References

- Support for `nocite` within \_project.yml for book projects (#1660)

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

## RevealJS Format

- Don't ignore auto stretch rules when speaker notes are present

## Miscellaneous

- Allow environment variables to override paths to binary dependencies
- Support `cover-image-alt` to specify alt text for a book's cover image
- Correctly support Giscus `category-id` property
- Correctly support `output-file` names that contain `.` characters (like `file.name.html`)
- Avoid file permission errors in additional cases (thanks @jmbuhr)
