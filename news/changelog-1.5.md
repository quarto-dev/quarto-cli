All changes included in 1.5:

## HTML Format

- ([#3178](https://github.com/quarto-dev/quarto-cli/issues/3178)): TOC now correctly expands when web page has no content to scroll to.
- ([#6992](https://github.com/quarto-dev/quarto-cli/issues/6992)): Properly render custom license URLs in HTML page appendix,
- ([#8118](https://github.com/quarto-dev/quarto-cli/issues/8118)): Add support for `body-classes` to add classes to the document body.
- ([#8311](https://github.com/quarto-dev/quarto-cli/issues/8311)): Correct z-order for margins with no contents
- ([#8862](https://github.com/quarto-dev/quarto-cli/issues/8862)): Properly deal with an `aside` within a definition list.
- ([#8863](https://github.com/quarto-dev/quarto-cli/issues/8863)): Properly wrap `monospace` text in definition lists.
- ([#8969](https://github.com/quarto-dev/quarto-cli/pull/8969)): Replace `polyfill.io` with `cdnjs.cloudflare.com` when using MathJax.
- ([#8990](https://github.com/quarto-dev/quarto-cli/issues/8990)): Copy button now works for embedded code source in modal window when optin-in `code-tools` feature.
- ([#9076](https://github.com/quarto-dev/quarto-cli/issues/9076)): Fix issue with `layout-ncol` and `column` settings in executable code cells.
- ([#9125](https://github.com/quarto-dev/quarto-cli/issues/9125)): Fix issue in browser console with TOC selection when the document is using ids for headers with specific characters (e.g russian language headers).
- ([#9539](https://github.com/quarto-dev/quarto-cli/issues/9539)): Improve SCSS of title blocks to avoid overwide columns in grid layout.
- Improve accessibility `role` for `aria-expandable` elements by ensuring their role supports the `aria-expanded` attribute.
- ([#9734](https://github.com/quarto-dev/quarto-cli/issues/9734)): Fix issue with unlabeled tables and `tbl-cap-location` information.

## PDF Format

- ([#8299](https://github.com/quarto-dev/quarto-cli/issues/8299)): Don't use `rsvg-convert` to convert an SVG to PDF when the PDF is already available; add `use-rsvg-convert` option to control this behavior.
- ([#8656](https://github.com/quarto-dev/quarto-cli/issues/8656)): Don't crash on captionless tables in subfloats.
- ([#8684](https://github.com/quarto-dev/quarto-cli/issues/8684)): Improve detection and automatic installation of locale specific hyphenation files.
- ([#8711](https://github.com/quarto-dev/quarto-cli/issues/8711)): Enforce rendering of tables as `tabular` environments when custom float environments are present.
- ([#8841](https://github.com/quarto-dev/quarto-cli/issues/8841)): Do not parse LaTeX table when crossref label doesn't start with `tbl-`.
- ([#9582](https://github.com/quarto-dev/quarto-cli/issues/9582)): Forward column classes and attributes correctly to floats inside divs with column classes.
- ([#9729](https://github.com/quarto-dev/quarto-cli/issues/9729)): Fix performance issue with Lua pattern matching and multiple capture groups.
- ([#9892](https://github.com/quarto-dev/quarto-cli/issues/9892)): Add more line breaks after Pandoc template partial inclusions cf. [#7273](https://github.com/quarto-dev/quarto-cli/issues/7293) to avoid partials themselves requiring additional linebreaks.
- ([#9944](https://github.com/quarto-dev/quarto-cli/issues/9944)): Fix issue with `lst-` crossrefs, `filename` attributes, and syntax highlighting.
- ([#10091](https://github.com/quarto-dev/quarto-cli/issues/10091)): Fix regression with `fig-align` attributes in captionless images.
- ([#10112](https://github.com/quarto-dev/quarto-cli/issues/10112)): Fix regression with `column: margin` in code cells that emit tables.

## RevealJS Format

- ([#8382](https://github.com/quarto-dev/quarto-cli/issues/8382)): Strip whitespace from `div.columns` elements that might have been introduced by third-party processing.
- ([#8498](https://github.com/quarto-dev/quarto-cli/issues/8498)): Strip whitespace following `div.column` elements.
- ([#9117](https://github.com/quarto-dev/quarto-cli/issues/9117)): Fix an issue with input filename containing special characters.
- ([#9548](https://github.com/quarto-dev/quarto-cli/issues/9548)): Providing `theme` at top level when `format: revealjs` is now probably inserting the right css in the resulting html.
- ([#9560](https://github.com/quarto-dev/quarto-cli/issues/9560)): Code block using `filename` correctly gets the header background color set.

## Docusaurus Format

- ([#8919](https://github.com/quarto-dev/quarto-cli/issues/8919)): Ensure enough backticks in code cell declarations.
- ([#9179](https://github.com/quarto-dev/quarto-cli/issues/9179)): Emit tables that Pandoc would write as HTML as RawBlock elements to ensure they are rendered correctly in Docusaurus.

## GFM Format

- ([#8283](https://github.com/quarto-dev/quarto-cli/issues/8283)): Maths are rendered using Mathjax in the HTML preview of a `format: gfm` document.
- ([#9507](https://github.com/quarto-dev/quarto-cli/issues/9507)): Add support for rendering `FloatRefTarget` elements in `gfm` format.

## Powerpoint Format

- ([#8667](https://github.com/quarto-dev/quarto-cli/issues/8667)): Fix regression with `FloatRefTarget` nodes in PPTX output.
- ([#9680](https://github.com/quarto-dev/quarto-cli/issues/9680), [#9681](https://github.com/quarto-dev/quarto-cli/issues/9681)): Fix issues with HTML tables parsed by Quarto when converting to powerpoint presentations.

## Interactive Document

- ([#9208](https://github.com/quarto-dev/quarto-cli/issues/9208)): `code-link` is ignored in `engine: knitr` interactive documents with `server: shiny`. This is because of a limitation from R package **downlit** when processing shiny pre-rendered document.

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
- ([#8904](https://github.com/quarto-dev/quarto-cli/issues/8904)): Flip order of page and website title on websites, cf WCAG 2.4.2.
- ([#8977](https://github.com/quarto-dev/quarto-cli/issues/8977)): Don't decorate about links within external link icons.
- ([#8986](https://github.com/quarto-dev/quarto-cli/issues/8986)): Search: only build subfuse index when it's safe to do so.
- ([#9356](https://github.com/quarto-dev/quarto-cli/issues/9356)): Don't process column classes for figures inside the About divs.
- ([#9524](https://github.com/quarto-dev/quarto-cli/issues/9524)): Fix canonical URL generation for website pages.
- ([#9781](https://github.com/quarto-dev/quarto-cli/issues/9781)): Correctly hide elements from click event in collapsed margin sidebar.
- ([#8987](https://github.com/quarto-dev/quarto-cli/issues/8987)): Fix issue with shortcode expansion in website titles.
- Sidebar navigation item now correctly supports `rel` attribute.
- `target` attribute for sidebar navigation items is now correctly inserted with HTML escapes.

## Book

- ([#8737](https://github.com/quarto-dev/quarto-cli/issues/8737)): Fix issue in `page-footer` when url are used in `href` for book's configuration.
- ([#8814](https://github.com/quarto-dev/quarto-cli/issues/8814)): Fix issue with `bibliography` field using urls in book's configuration.
- ([#9269](https://github.com/quarto-dev/quarto-cli/issues/9269)): Fix issue with icons in download dropdown for multiple book formats.

## OJS

- ([#8327](https://github.com/quarto-dev/quarto-cli/issues/8327)): Issue error messages on console so they're visible in the case of hidden OJS cells.
- ([#8372](https://github.com/quarto-dev/quarto-cli/issues/8372)): Fix issue with OJS cells not being properly hidden in Hugo output when `output: false`.

## Typst

- ([#8539](https://github.com/quarto-dev/quarto-cli/issues/8539)): Support for Typst theorems and their ilk via [typst-theorems](https://github.com/sahasatvik/typst-theorems).
- ([#9619](https://github.com/quarto-dev/quarto-cli/pull/9619)): Typst CSS - for a small set of elements and properties, Quarto will translate the CSS property to a Typst property. This is especially useful for processed HTML tables and `<pre>`s.
- ([#9293](https://github.com/quarto-dev/quarto-cli/pull/9293)): Add `toc-indent` to control indentation of entries in the table of contents.
- ([#9671](https://github.com/quarto-dev/quarto-cli/issues/9671)): Reimplement `typst` subfloats to fix subfloat counters.
- ([#9694](https://github.com/quarto-dev/quarto-cli/issues/9694)): Fix default callout (`::: callout ... ::: `) in Typst.
- ([#9722](https://github.com/quarto-dev/quarto-cli/issues/9722)): Resolve data URI images in Typst.
- ([#9555](https://github.com/quarto-dev/quarto-cli/issues/9555)): Text elements in Typst are internationalized.
- ([#9887](https://github.com/quarto-dev/quarto-cli/issues/9887)): Use correct supplement for div floats in Typst.
- ([#9972](https://github.com/quarto-dev/quarto-cli/issues/9972)): Fix crashes with unnumbered sections.
- ([#8797](https://github.com/quarto-dev/quarto-cli/issues/8797), [#10086](https://github.com/quarto-dev/quarto-cli/issues/10086)): Tables should be centered in cell output.
- ([#9857](https://github.com/quarto-dev/quarto-cli/issues/9857)): `id`-less figures inside another figure should be treated the same as `FloatRefTarget` and get lettered
- ([#9885](https://github.com/quarto-dev/quarto-cli/issues/9885)): Turn off Typst CSS with `css-property-parsing: none`, default `translate`.
- ([#10055](https://github.com/quarto-dev/quarto-cli/pull/10055)): Enable `html-pre-tag-processing` with a fenced div, disable it in metadata with `none`.
- ([#10075](https://github.com/quarto-dev/quarto-cli/pull/10075)): Bring `quarto create` templates for Typst up-to-date with the format.
- ([#10123](https://github.com/quarto-dev/quarto-cli/issues/10123)): Warn when unsupported caption location is used, and default to `bottom`.
- Upgrade Typst to 0.11.0
- Upgrade the Typst template to draw tables without grid lines by default, in accordance with latest Pandoc.

## Jupyter

- ([#4802](https://github.com/quarto-dev/quarto-cli/issues/4802)): Change name of temporary input notebook to avoid accidental overwriting.
- ([#8433](https://github.com/quarto-dev/quarto-cli/issues/8433)): Escape jupyter widget states that contain `</script>` so they can be embedded in HTML documents.
- When searching for kernelspecs that match `python`, prefer one one that matches an active Python venv.
- ([#8454](https://github.com/quarto-dev/quarto-cli/issues/8454)): Allow Jupyter engine to handle markdown files with mixed-case extensions.
- ([#8919](https://github.com/quarto-dev/quarto-cli/issues/8919)): Ensure enough backticks in `quarto convert` from `.ipynb` to `.qmd` files.
- ([#8998](https://github.com/quarto-dev/quarto-cli/issues/8998)): Interpret slide separation markers `---` correctly when creating the `.ipynb` intermediate notebook from a `.qmd` file.
- ([#9056](https://github.com/quarto-dev/quarto-cli/issues/9056)): Fix issue with extra columns in `format: dashboard` and Jupyter notebooks.
- ([#9133](https://github.com/quarto-dev/quarto-cli/issues/9133)): Fix issue with Jupyter engine when using paths containing special characters.
- ([#9255](https://github.com/quarto-dev/quarto-cli/issues/9255)): Support cell source fields of type `string`.
- ([#9422](https://github.com/quarto-dev/quarto-cli/issues/9422)): Improve the stream merging algorithm in output cells to avoid merging outputs that should not be merged.
- ([#9536](https://github.com/quarto-dev/quarto-cli/issues/9536)): Provide traceback when available in Jupyter error outputs.
- ([#9470](https://github.com/quarto-dev/quarto-cli/issues/9470)): Fix images rendered by the Jupyter engine to be displayed with the same dimensions as those in notebooks.
- ([#5413](https://github.com/quarto-dev/quarto-cli/issues/5413)): Fix issue with Jupyter engine cells and images with captions containing newlines.
- ([#9896](https://github.com/quarto-dev/quarto-cli/issues/9896)): Fix an issue with executing notebook with no kernelspec metadata yet.

## Website Listings

- ([#8147](https://github.com/quarto-dev/quarto-cli/issues/8147)): Ensure that listings don't include the contents of the output directory
- ([#8435](https://github.com/quarto-dev/quarto-cli/issues/8435)): Improve listing filtering using special characters
- ([#8627](https://github.com/quarto-dev/quarto-cli/issues/8627)): Localize the text that appears as placeholder in listing filters.
- ([#8715](https://github.com/quarto-dev/quarto-cli/issues/8715)): Listings should respect `image: false`
- ([#8860](https://github.com/quarto-dev/quarto-cli/discussions/8860)): Don't show duplicate author names.
- ([#9030](https://github.com/quarto-dev/quarto-cli/discussions/9030)): Warn (rather than error) when listing globs produce an empty listing (as this is permissable).
- ([#9447](https://github.com/quarto-dev/quarto-cli/pull/9447)): Add support for the boolean `image-lazy-loading` option to enable lazy loading of images in listings (default: `true`).
- ([#9845](https://github.com/quarto-dev/quarto-cli/issues/9845)): `image-placeholder` now correctly works when multiple listings are used.

## Manuscripts

- ([#8277](https://github.com/quarto-dev/quarto-cli/issues/8277)): Improve notebook ordering within Manuscript projects
- ([#8974](https://github.com/quarto-dev/quarto-cli/issues/8974)): Fix theorem rendering in Manuscript projects

## Extensions

- ([#8385](https://github.com/quarto-dev/quarto-cli/issues/8385)): Properly copy project resources when extensions are installed at project level.
- ([#8547](https://github.com/quarto-dev/quarto-cli/issues/8547)): Support installing extensions from github branch with forward slash in the name.
- ([#9918](https://github.com/quarto-dev/quarto-cli/issues/9918)): `format-resources` can use explicit [Quarto glob syntax](https://quarto.org/docs/reference/globs.html), e.g. `format-resources: dir/**/*` to copy all files in `dir` and its subdirectories to input root, but use `format-resources: dir` to copy `dir` and its contents to input root.
- ([#9948](https://github.com/quarto-dev/quarto-cli/issues/9948)): New extension type: `metadata`. Example use case: support `pre-render` and `post-render` script lists in `project` metadata.

## Shortcodes

- ([#8316](https://github.com/quarto-dev/quarto-cli/issues/8316)): Add fallback value for the `env` shortcode.
- ([#9011](https://github.com/quarto-dev/quarto-cli/issues/9011)): `embed` shortcode now renders the embedded document without error when it is using knitr engine and have some outputs with HTML dependencies.
- ([#9635](https://github.com/quarto-dev/quarto-cli/issues/9635)): Respect `{shortcodes=false}` when resolving `include` shortcodes.
- ([#9664](https://github.com/quarto-dev/quarto-cli/pull/9664)): Add `placeholder` shortcode to produce placeholder images.
- ([#9665](https://github.com/quarto-dev/quarto-cli/issues/9665)): Fix issue with key-value arguments of shortcode handlers in code contexts.
- ([#9793](https://github.com/quarto-dev/quarto-cli/issues/9793)): `embed` shortcode now correctly retrieve svg image from embdedded cell.
- ([#9903](https://github.com/quarto-dev/quarto-cli/issues/9903)): Allow shortcode resolution inside element attributes (currently headers, divs, spans, images, links). Currently, this requires attributes to be specified with single quotes, see issue for details.

## Lightbox Images

- ([#8607](https://github.com/quarto-dev/quarto-cli/issues/8607)): Ensure we properly use the `description` attribute if it is present.

## Filters

- ([#8417](https://github.com/quarto-dev/quarto-cli/issues/8417)): Maintain a single AST element in the output cells when parsing HTML from RawBlock elements.
- ([#8582](https://github.com/quarto-dev/quarto-cli/issues/8582)): Improve the algorithm for extracting table elements from HTML RawBlock elements.
- ([#8770](https://github.com/quarto-dev/quarto-cli/issues/8770)): Handle inconsistently-defined float types and identifier names more robustly in HTML tables.
- ([#9862](https://github.com/quarto-dev/quarto-cli/issues/9862)): Fix crash with labeled tables in cells with `eval: false` and `echo: false`.
- ([#10100](https://github.com/quarto-dev/quarto-cli/issues/10100)): Fix crash with empty div containing the `filename` attribute.

## Engines

- ([#8388](https://github.com/quarto-dev/quarto-cli/issues/8388)): add `QUARTO_PROJECT_ROOT` and `QUARTO_DOCUMENT_PATH` to the environment when invoking execution engines.

## Article Layout

- ([#8614](https://github.com/quarto-dev/quarto-cli/issues/8614)): Don't improperly forward column classes onto grids.

## Publishing

- ([#9308](https://github.com/quarto-dev/quarto-cli/issues/9308)): Improved error message when trying to publish to Github pages with `quarto publish gh-pages`.
- ([#9585](https://github.com/quarto-dev/quarto-cli/issues/9585)): Improved `quarto publish gh-pages` workflow when existing gh-pages branch is present or problem with the remote repository.

## `quarto inspect`

- ([#8451](https://github.com/quarto-dev/quarto-cli/issues/8451)): `quarto inspect` now validates documents and will throw an error if the document is invalid.
- ([#8939](https://github.com/quarto-dev/quarto-cli/pull/8939)): `quarto inspect` now takes an additional optional parameter to specify the output file, and provides the graph of include dependencies for the inspection target.
- ([#9264](https://github.com/quarto-dev/quarto-cli/pull/9264)): `quarto inspect` now provides information about the code cells in the inspection target.

## `quarto check`

- `quarto check` now checks a minimal version of Typst and prints the version, to aid with troubleshooting.

## `quarto typst`

- ([#9106](https://github.com/quarto-dev/quarto-cli/issues/9106)): Do not allow `quarto typst update`.

## Quarto's input format

- Quarto now supports raw block and raw inline elements of types `pandoc-native` and `pandoc-json`, and will use Pandoc's `native` and `json` reader to convert these elements to Pandoc's AST. This is useful in situations where emitting Markdown is not sufficient or convient enough to express the desired structure of a document.

## Lua filters

- ([#9572](https://github.com/quarto-dev/quarto-cli/issues/9572)): Add `quarto.config.cli_path()` in Quarto LUA to return the path to the Quarto CLI executable of the installation running the Lua script in quarto context.
- ([#9691](https://github.com/quarto-dev/quarto-cli/issues/9691)): Provide default Attr object to `quarto.Tabset` constructor.
- ([#9696](https://github.com/quarto-dev/quarto-cli/issues/9696)): Don't use `.hidden` in `data-qmd` scaffolds.

## Other Fixes and Improvements

- ([#6945](https://github.com/quarto-dev/quarto-cli/issues/6945)): Allow `classes: plain` to disable the default treatment of computataional tables in code cells.
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
- ([#8937](https://github.com/quarto-dev/quarto-cli/issues/8937)): Fix unix launcher script to properly handle spaces in the path to the quarto executable.
- ([#8898](https://github.com/quarto-dev/quarto-cli/issues/8898)): `.deb` and `.tar.gz` bundle contents are now associated to root user and group instead of default user and group for CI build runners.
- ([#9041](https://github.com/quarto-dev/quarto-cli/issues/9041)): When creating an automatic citation key, replace spaces with underscores in inferred keys.
- ([#9059](https://github.com/quarto-dev/quarto-cli/issues/9059)): `quarto run` now properly works on Windows with Lua scripts.
- ([#9282](https://github.com/quarto-dev/quarto-cli/issues/9282)): Fix name clash in Lua local declarations for `mediabag` in bundled releases.
- ([#9394](https://github.com/quarto-dev/quarto-cli/issues/9394)): Make `template` a required field in the `about` schema.
- ([#9426](https://github.com/quarto-dev/quarto-cli/issues/9426)): Update `crossref.lua` filter to avoid crashes and hangs in documents with custom AST nodes.
- ([#9460](https://github.com/quarto-dev/quarto-cli/pulls/9460)): `$valuebox-bg-{color}` Sass variables, e.g. `$valuebox-bg-primary`, can now be set directly for custom value box background colors.
- ([#9492](https://github.com/quarto-dev/quarto-cli/issues/9492)): Improve performance of `quarto preview` when serving resource files of the following formats: HTML, PDF, DOCX, and plaintext.
- ([#9496](https://github.com/quarto-dev/quarto-cli/issues/9496)): Improve parsing error message from `js-yaml` when `key:value` is used together with `key: value` in the same YAML block.
- ([#9527](https://github.com/quarto-dev/quarto-cli/pull/9527)): Add `quarto.format` and `quarto.format.typst` to Quarto's public Lua filter API.
- ([#9547](https://github.com/quarto-dev/quarto-cli/issues/9547)): Fix issue with `quarto preview` and resources found in URLs with hash and search fragments.
- ([#9550](https://github.com/quarto-dev/quarto-cli/issues/9550)): Don't crash when subcaptions are incorrectly specified with `fig-subcap: true` but no embedded subcaptions.
- ([#9652](https://github.com/quarto-dev/quarto-cli/pull/9652)): Allow `--output-dir` to refer to absolute paths in `quarto render`.
- ([#9701](https://github.com/quarto-dev/quarto-cli/issues/9701)): Fix issue with callouts with non-empty titles that have no string content.
- ([#9724](https://github.com/quarto-dev/quarto-cli/issues/9724)): Force-align text in floats of type `Listing` to the left.
- ([#9727](https://github.com/quarto-dev/quarto-cli/issues/9727)): `lightbox`: do not overwrite `window.onload` events.
- ([#9792](https://github.com/quarto-dev/quarto-cli/issues/9798)): Fix a 1.5 regression where `freeze` would be accidentally triggered in single-file renders.
- ([#10003](https://github.com/quarto-dev/quarto-cli/issues/10003)): fix Giscus light/dark theme YAML example in schema where `theme` is missing.
- Add support for `{{< lipsum >}}` shortcode, which is useful for emitting placeholder text. Provide a specific number of paragraphs (`{{< lipsum 3 >}}`).
- Resolve data URIs in Pandoc's mediabag when rendering documents.
- Increase v8's max heap size by default, to avoid out-of-memory errors when rendering large documents (also cf. https://github.com/denoland/deno/issues/18935).
- When running `quarto check` from a development build (from a git repository), show the git commit hash in addition to the version string.
- Upgrade Deno to 1.41.0
- `quarto install tinytex` will now try to set the default CTAN repository to the nearest mirror resolved from https://mirror.ctan.org.
- `quarto render --to native` now works without triggering rmarkdown error about non HTML output when HTML dependencies are present in the knitr engine cell results.
- Missing `tabsets` configuration for HTML documents has now been added in the YAML schema for validation and autocompletion. This boolean value controls the inclusion of tabsets in the document (e.g when `minimal: true` is set).

## Languages

- ([#10141](https://github.com/quarto-dev/quarto-cli/issues/10141)): Swiss German translation for Quarto UI text (credit: @rastrau)
