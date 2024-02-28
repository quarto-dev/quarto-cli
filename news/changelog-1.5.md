All changes included in 1.5:

## HTML Format

- ([#6992](https://github.com/quarto-dev/quarto-cli/issues/6992)): Properly render custom license URLs in HTML page appendix,
- ([#8118](https://github.com/quarto-dev/quarto-cli/issues/8118)): Add support for `body-classes` to add classes to the document body.
- ([#8311](https://github.com/quarto-dev/quarto-cli/issues/8311)): Correct z-order for margins with no contents
- ([#8862](https://github.com/quarto-dev/quarto-cli/issues/8862)): Properly deal with an `aside` within a definition list.

## PDF Format

- ([#8299](https://github.com/quarto-dev/quarto-cli/issues/8299)): Don't use `rsvg-convert` to convert an SVG to PDF when the PDF is already available; add `use-rsvg-convert` option to control this behavior.
- ([#8684](https://github.com/quarto-dev/quarto-cli/issues/8684)): Improve detection and automatic installation of locale specific hyphenation files.
- ([#8711](https://github.com/quarto-dev/quarto-cli/issues/8711)): Enforce rendering of tables as `tabular` environments when custom float environments are present.
- ([#8841](https://github.com/quarto-dev/quarto-cli/issues/8841)): Do not parse LaTeX table when crossref label doesn't start with `tbl-`.

## RevealJS Format

- ([#8382](https://github.com/quarto-dev/quarto-cli/issues/8382)): Strip whitespace from `div.columns` elements that might have been introduced by third-party processing.

## Website

- ([#6779](https://github.com/quarto-dev/quarto-cli/issues/6779)): Add support for `logo-href` and `logo-alt` in `sidebar` (books and websites)
- ([#7318](https://github.com/quarto-dev/quarto-cli/issues/7318)): Don't improperly overwrite page titles
- ([#8108](https://github.com/quarto-dev/quarto-cli/issues/8108)): Individual pages can suppress breadcrumbs using `bread-crumbs: false`
- ([#8132](https://github.com/quarto-dev/quarto-cli/issues/8132)): Properly escape urls in the sitemap.
- ([#8267](https://github.com/quarto-dev/quarto-cli/issues/8267)): Improve responsive layout of `page-footer`
- ([#8294](https://github.com/quarto-dev/quarto-cli/issues/8294)): Add support for website announcements, using the `announcement` key under `website`.
- ([#8426](https://github.com/quarto-dev/quarto-cli/issues/8426)): Ignore invalid dates for references when generating Google Scholar data.
- ([#8544](https://github.com/quarto-dev/quarto-cli/issues/8544)): Fix about page layout when using an `id` to provide contents.
- ([#8588](https://github.com/quarto-dev/quarto-cli/issues/8588)): Fix display of `bread-crumbs` on pages with banner style title blocks.
- ([#8830](https://github.com/quarto-dev/quarto-cli/issues/8830)): Add support for `tools-collapse` to control whether the tools collapse when the navbar does.
- ([#8851](https://github.com/quarto-dev/quarto-cli/issues/8851)): Don't strip `index.html` from external paths.

## Book

- ([#8737](https://github.com/quarto-dev/quarto-cli/issues/8737)): Fix issue in `page-footer` when url are used in `href` for book's configuration.
- ([#8814](https://github.com/quarto-dev/quarto-cli/issues/8814)): Fix issue with `bibliography` field using urls in book's configuration.

## OJS

- ([#8327](https://github.com/quarto-dev/quarto-cli/issues/8327)): Issue error messages on console so they're visible in the case of hidden OJS cells.

## Typst

- ([#8539](https://github.com/quarto-dev/quarto-cli/issues/8539)): Support for Typst theorems and their ilk via [typst-theorems](https://github.com/sahasatvik/typst-theorems).

## Jupyter

- ([#4802](https://github.com/quarto-dev/quarto-cli/issues/4802)): Change name of temporary input notebook to avoid accidental overwriting.
- ([#8433](https://github.com/quarto-dev/quarto-cli/issues/8433)): Escape jupyter widget states that contain `</script>` so they can be embedded in HTML documents.
- When searching for kernelspecs that match `python`, prefer one one that matches an active Python venv.
- ([#8454](https://github.com/quarto-dev/quarto-cli/issues/8454)): Allow Jupyter engine to handle markdown files with mixed-case extensions.

## Website Listings

- ([#8147](https://github.com/quarto-dev/quarto-cli/issues/8147)): Ensure that listings don't include the contents of the output directory
- ([#8435](https://github.com/quarto-dev/quarto-cli/issues/8435)): Improve listing filtering using special characters
- ([#8627](https://github.com/quarto-dev/quarto-cli/issues/8627)): Localize the text that appears as placeholder in listing filters.
- ([#8715](https://github.com/quarto-dev/quarto-cli/issues/8715)): Listings should respect `image: false`
- ([#8860](https://github.com/quarto-dev/quarto-cli/discussions/8860)): Don't show duplicate author names.

## Manuscripts

- ([#8277](https://github.com/quarto-dev/quarto-cli/issues/8277)): Improve notebook ordering within Manuscript projects

## Extensions

- ([#8385](https://github.com/quarto-dev/quarto-cli/issues/8385)): Properly copy project resources when extensions are installed at project level.
- ([#8547](https://github.com/quarto-dev/quarto-cli/issues/8547)): Support installing extensions from github branch with forward slash in the name.

## Shortcodes

- ([#8316](https://github.com/quarto-dev/quarto-cli/issues/8316)): Add fallback value for the `env` shortcode

## Lightbox Images

- ([#8607](https://github.com/quarto-dev/quarto-cli/issues/8607)): Ensure we properly use the `description` attribute if it is present.

## Filters

- ([#8417](https://github.com/quarto-dev/quarto-cli/issues/8417)): Maintain a single AST element in the output cells when parsing HTML from RawBlock elements.
- ([#8582](https://github.com/quarto-dev/quarto-cli/issues/8582)): Improve the algorithm for extracting table elements from HTML RawBlock elements.

## Engines

- ([#8388](https://github.com/quarto-dev/quarto-cli/issues/8388)): add `QUARTO_PROJECT_ROOT` and `QUARTO_DOCUMENT_PATH` to the environment when invoking execution engines.

## Article Layout

- ([#8614](https://github.com/quarto-dev/quarto-cli/issues/8614)): Don't improperly forward column classes onto grids.

## Other Fixes

- ([#8119](https://github.com/quarto-dev/quarto-cli/issues/8119)): More intelligently detect when ejs templates are modified during development, improving quality of life during preview.
- ([#8177](https://github.com/quarto-dev/quarto-cli/issues/8177)): Use an explicit path to `sysctl` when detecting MacOS architecture. (author: @kevinushey)
- ([#8274](https://github.com/quarto-dev/quarto-cli/issues/8274)): set `LUA_CPATH` to '' if unset, avoiding accidentally loading incompatible system-wide libraries.
- ([#8401](https://github.com/quarto-dev/quarto-cli/issues/8401)): Ensure that files created with `quarto create <project_name>` have lowercase filenames.
- ([#8438](https://github.com/quarto-dev/quarto-cli/issues/8438)): Ensure that sub commands properly support logging control flags (e.g. `--quiet`, etc).
- ([#8422](https://github.com/quarto-dev/quarto-cli/issues/8422)): Improve dashboard validation and sauto-completion support for external tools
- ([#8486](https://github.com/quarto-dev/quarto-cli/issues/8486)): Improve arrow theme differentation of Keywords and Control Flow elements
- ([#8524](https://github.com/quarto-dev/quarto-cli/issues/8524)): Improve detection of R environment which configuring Binder using 'quarto use'. Check for lock files, pre and post render scripts that use R.
- ([#8540](https://github.com/quarto-dev/quarto-cli/issues/8540)): Allow title to be specifed separately when creating a project
- ([#8652](https://github.com/quarto-dev/quarto-cli/issues/8652)): Make code cell detection in IDE tooling consistent across editor modes.
- ([#8779](https://github.com/quarto-dev/quarto-cli/issues/8779)): Resolve shortcode includes before engine and target determination.
- ([#8873](https://github.com/quarto-dev/quarto-cli/issues/8873)): Don't overwrite supporting files when creating a project.
- Add support for `{{< lipsum >}}` shortcode, which is useful for emitting placeholder text. Specify a specific number of paragraphs (`{{< lipsum 3 >}}`).
- Increase v8's max heap size by default, to avoid out-of-memory errors when rendering large documents (also cf. https://github.com/denoland/deno/issues/18935).
- Upgrade Deno to 1.41.0
