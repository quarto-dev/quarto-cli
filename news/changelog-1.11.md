All changes included in 1.11:

## Regression fixes

- ([#14920](https://github.com/quarto-dev/quarto-cli/issues/14920)): Fix Windows ARM diagnostics for x64 R crashes to preserve the specialized error in `quarto check`, JSON output, and render failures, and update the native ARM64 R installation guidance.
- ([#14731](https://github.com/quarto-dev/quarto-cli/pull/14731)): Fix `QUARTO_VENDOR_BINARIES=false` builds silently succeeding with missing binaries. The `configure` step's "is it on PATH?" check for `typst-gather`, `typst`, `pandoc` and `esbuild` compared an unawaited `Promise` against `undefined`, so the guard never fired. A build with `typst-gather` neither vendored nor on PATH reported success and produced a Quarto tree without it, surfacing only at render time as `typst-gather analyze failed; staging all packages as fallback`. The missing-binary error message now also names the path that was checked and the `QUARTO_TYPST_GATHER` environment variable.
- ([#14741](https://github.com/quarto-dev/quarto-cli/issues/14741)): Fix PDF rendering of a cross-referenced table failing with `! Extra }, or forgotten \endgroup.` when the `endfloat` package defers `longtable` environments (`\DeclareDelayedFloatFlavor*{longtable}{table}`).
- ([#14857](https://github.com/quarto-dev/quarto-cli/issues/14857)): Fix `quarto install chrome-headless-shell` (and `quarto install chromium`) failing with a 404 on Linux arm64 due to a stale Playwright CDN URL.
- ([#14946](https://github.com/quarto-dev/quarto-cli/issues/14946)): Fix `revealjs` and `dashboard` logos resolving to broken paths in documents in a project subdirectory when the project has a brand (regression introduced in v1.8.22). Logo paths are now always relative to the document; a project-relative logo path in a website with a brand still works but prints a deprecation warning.
- ([#14993](https://github.com/quarto-dev/quarto-cli/issues/14993)): Fix Typst output dropping a brand font from a `font-family` list when another document in the same directory or project was rendered first with different brand fonts.

## Dependencies

- ([#15043](https://github.com/quarto-dev/quarto-cli/issues/15043)): Update the OJS runtime to acorn 8.17, Observable Inspector 5.0.1, and Observable Inputs 0.10.6. `FileAttachment(...).mimeType` now reports `text/javascript` instead of `application/javascript` for `.js` and `.mjs` files.

## Accessibility

- ([#730](https://github.com/quarto-dev/quarto-cli/issues/730)): Fix keyboard navigation of tabsets in HTML documents without Bootstrap (`theme: none`): Tab now moves from the selected tab into its panel instead of selecting the next tab, and the arrow keys switch tabs.
- ([#3873](https://github.com/quarto-dev/quarto-cli/issues/3873), [#9003](https://github.com/quarto-dev/quarto-cli/issues/9003)): Honor `fig-alt` for Mermaid and Graphviz diagrams in HTML, revealjs, DOCX, and Typst output while preserving visible captions. (author: @jooyoungseo)
- ([#5514](https://github.com/quarto-dev/quarto-cli/issues/5514)): Fix `fig-alt` being ignored in `docx` output. Images and figures, including computational figures, now use it as their Word alternative text instead of the caption or an empty description, and the visible caption is unchanged. (author: @jooyoungseo)
- ([#7058](https://github.com/quarto-dev/quarto-cli/issues/7058)): Move the navbar search control after the navigation links and tools in the DOM so keyboard and screen-reader order matches the visual order. The rendered layout is unchanged (navbar positioning is controlled by CSS `order`), but custom CSS or JS that relied on `#quarto-search` preceding the navbar links in the DOM may need updating.
- ([#13463](https://github.com/quarto-dev/quarto-cli/issues/13463)): The dark/light mode toggle is now a switch (`button` with `role="switch"`, `aria-checked`, and a localized `aria-label`) instead of a link.
- ([#14615](https://github.com/quarto-dev/quarto-cli/issues/14615)): Fix invalid `role="menu"` on the website navbar's collapse toggle button, flagged by axe-core (`aria-allowed-role`) and WAVE (`aria-role-mismatch`).
- ([#12116](https://github.com/quarto-dev/quarto-cli/issues/12116), [#4935](https://github.com/quarto-dev/quarto-cli/issues/4935)): Website sidebar section toggles are now `<button>` elements, so they are keyboard accessible and properly announced.
- ([#14774](https://github.com/quarto-dev/quarto-cli/issues/14774)): Fix missing keyboard focus indicator on the code tools button and on a website's sidebar toggle and sidebar search buttons.
- ([#14376](https://github.com/quarto-dev/quarto-cli/issues/14376)): Add a distinct, localizable `aria-label` to each navigation landmark of websites and books: the navbar (`Site`), the sidebar (`Section`, or `Site` when there is no navbar), the narrow-viewport toolbar (`Toolbar`), the previous/next page navigation (`Page`), and the breadcrumbs (`Breadcrumbs`) (previously hardcoded English `breadcrumb`). The new `navigation-*-label` language keys can be overridden with `language:` metadata.
- ([#14376](https://github.com/quarto-dev/quarto-cli/issues/14376)): Translate the new `navigation-*-label` keys in all 33 built-in language files. The values are drawn from existing human-translated interface strings (LibreOffice, GNOME, Wikidata) and each one carries a comment naming its source; values that were adapted rather than used verbatim are marked `needs review`.
- ([#14376](https://github.com/quarto-dev/quarto-cli/issues/14376)): Label the table of contents `<nav>` with its localized title (`aria-labelledby`), in `html` and `revealjs` output, so assistive technology can tell it apart from other navigation landmarks.
- ([#14378](https://github.com/quarto-dev/quarto-cli/issues/14378)): Make scrollable code blocks and cell output keyboard-focusable in HTML output, so keyboard users can Tab to them and scroll with the arrow keys (axe rule `scrollable-region-focusable`, WCAG 2.1.1). While a region overflows it gets `tabindex="0"`, `role="group"`, and a localized `aria-label` (new `scrollable-code-label` and `scrollable-output-label` language keys, translated in all 34 built-in language files); when it fits again the attributes are removed. Chrome and Firefox already focus such regions natively; this adds Safari coverage and an accessible name.
- ([#14795](https://github.com/quarto-dev/quarto-cli/issues/14795)): Fix keyboard focus in `revealjs` presentations reaching links and controls on nearby slides that are not shown. Tab now stays on the current slide, except in overview, scroll and print views where all slides are shown.
- ([#14952](https://github.com/quarto-dev/quarto-cli/issues/14952)): Fix `revealjs` presentations disabling pinch-zoom on touch devices. The viewport `<meta>` tag no longer sets `maximum-scale=1.0` and `user-scalable=no`, which axe-core flagged (`meta-viewport`).
- ([#14968](https://github.com/quarto-dev/quarto-cli/issues/14968)): The header of notebook preview pages (back link, notebook title, download link) is now a navigation landmark named after the notebook, so it is reachable through landmark navigation and no longer flagged by axe-core (`region`).
- ([#15011](https://github.com/quarto-dev/quarto-cli/issues/15011)): Fix the slide menu of `revealjs` presentations being read by screen readers while it is closed and off screen, and Tab moving keyboard focus to it once it lists more slides than fit. (author: @jooyoungseo)
- ([#15015](https://github.com/quarto-dev/quarto-cli/issues/15015)): Fix the "Back to Article" link of notebook previews in website projects not being reachable or usable with the keyboard.
- ([#15019](https://github.com/quarto-dev/quarto-cli/issues/15019)): Fix screen reader announcements in `revealjs` presentations including incremental content before it is revealed and repeating slides and fragments when browser history is enabled. (author: @jooyoungseo)
- ([#15030](https://github.com/quarto-dev/quarto-cli/pull/15030)): Fix `axe` checks in `revealjs` presentations hiding the current slide from screen readers when moving to another slide while the scan runs.
- ([#15033](https://github.com/quarto-dev/quarto-cli/issues/15033)): Fix screen reader announcements in `revealjs` presentations reading the CSS inside Mermaid diagrams, omitting image alternative text, and reading the contents of `role="img"` graphics instead of their accessible names. (author: @jooyoungseo)
- ([#15080](https://github.com/quarto-dev/quarto-cli/issues/15080)): Fix footnote, citation, cross-reference and code annotation popups not closing with Esc, and staying open over the next focused element after keyboard focus leaves them.

## Formats

### All Formats

- ([#14772](https://github.com/quarto-dev/quarto-cli/issues/14772)): Custom `language` keys now reach templates through `$quarto.language.<key>$`. A key that Quarto does not ship passed schema validation and was merged over the defaults, then discarded before templates saw it, so it expanded to an empty string with no warning. (author: @mcanouil)
- ([#14882](https://github.com/quarto-dev/quarto-cli/issues/14882)): Fix brand font families with a word starting with a digit, such as `Source Sans 3`, not applying in `html` and `revealjs` output. The same names in `mainfont` now also apply in `revealjs`. (author: @Masad791)

### `dashboard`

- ([#14818](https://github.com/quarto-dev/quarto-cli/issues/14818)): Fix a dashboard with more than one page going blank when the URL hash does not name a page, such as a footnote link or a cross-reference link.
- ([#14819](https://github.com/quarto-dev/quarto-cli/issues/14819)): Fix keyboard focus starting inside the page content when a dashboard opens at a page hash, such as `dashboard.html#sales`. Tabbing backward now correctly returns to the page navigation tabs.
- ([#15023](https://github.com/quarto-dev/quarto-cli/issues/15023)): Fix a dashboard cell's HTML output being moved out of its card when the output contains text such as `bslib` or the word "subslide", and the card being dropped, title included, when the cell shows nothing else. (author: @jooyoungseo)

### `html`

- ([#12452](https://github.com/quarto-dev/quarto-cli/issues/12452)): Fix repeated HTML escaping in Google Scholar metadata, including apostrophes in titles, special characters in authors and URLs, and nested reference metadata.
- ([#12650](https://github.com/quarto-dev/quarto-cli/issues/12650)): Fix markdown formatting and HTML entities in a document title appearing literally in the appendix citation, the BibTeX citation, and the Google Scholar `citation_title`. (author: @jolars)
- ([#14684](https://github.com/quarto-dev/quarto-cli/issues/14684)): Add a "Skip to main content" link to Bootstrap-themed HTML output (documents, websites, books, dashboards) so keyboard users can bypass the navbar and sidebars.
- ([#14973](https://github.com/quarto-dev/quarto-cli/issues/14973)): Fix Safari sometimes opening pages with a light and dark theme at the top instead of at the URL fragment target, and toggling the color scheme scrolling back to the top of the page.
- ([#14976](https://github.com/quarto-dev/quarto-cli/pull/14976)): Fix KaTeX math not rendering on pages with Jupyter widgets when `html-math-method` is set with the object form (`method: katex` and `url`).
- ([#15049](https://github.com/quarto-dev/quarto-cli/pull/15049)): Fix Google Scholar reference metadata including unused entries from a shared bibliography. Reference tags now follow the rendered citations and bibliography, including entries added with `nocite` and citations with a suppressed bibliography. (author: @jolars)
- ([#15051](https://github.com/quarto-dev/quarto-cli/pull/15051)): Fix a callout's `title` option also rendering as an HTML `title` attribute in html, revealjs and epub output, which showed the title as a tooltip over the whole callout.
- ([#15108](https://github.com/quarto-dev/quarto-cli/pull/15108)): Fix Google Scholar metadata showing formatting markup such as `<i>` in `citation_reference` tags for bibliography entries, and `undefined` as the book title of a chapter without one.
- ([#15115](https://github.com/quarto-dev/quarto-cli/pull/15115)): Fix Google Scholar writing two `citation_reference` tags for a reference defined in two bibliography files. The tag now describes the entry Pandoc renders.

### `pdf`

- ([#14982](https://github.com/quarto-dev/quarto-cli/issues/14982)): Fix a footnote in document metadata, such as `title` or `author`, making PDF and Typst output shift heading levels, which turned the first level-1 heading into the document title.
- ([#15027](https://github.com/quarto-dev/quarto-cli/issues/15027)): Fix PDF rendering with regional German variants such as `lang: de-CH` failing when German hyphenation patterns are not installed, instead of installing them automatically.
- ([#15035](https://github.com/quarto-dev/quarto-cli/issues/15035)): Fix automatic installation of missing hyphenation patterns for the pinned German patterns (`ngerman-x-latest`), for several languages at once, and for languages loaded with `polyglossia`.

### `revealjs`

- ([#14996](https://github.com/quarto-dev/quarto-cli/pull/14996)): Fix `controls: auto` and `previewLinks: auto` set at the top level of a revealjs document's front matter producing a presentation that fails to load, because `auto` was written unquoted into the generated JavaScript.
- ([#15007](https://github.com/quarto-dev/quarto-cli/pull/15007)): Fix Home/End on a focused tabset tab also jumping to the first or last slide in addition to switching tabs.
- ([#15014](https://github.com/quarto-dev/quarto-cli/issues/15014)): Fix code blocks at the end of a callout losing their bottom spacing, which made the code block border touch the callout border in untitled `appearance="simple"` callouts (regression introduced in v1.8.15).
- ([#15036](https://github.com/quarto-dev/quarto-cli/issues/15036)): Fix callouts with an id rendering that id twice, on the callout and on a wrapper div, in `revealjs` and `epub` output. The id is now only on the `.callout` div, as in `html` output.
- ([#15037](https://github.com/quarto-dev/quarto-cli/pull/15037)): Fix `dracula` theme coloring a `<b>` in a callout title with the theme's bold color, unlike `<strong>`.

### `typst`

- ([#11683](https://github.com/quarto-dev/quarto-cli/issues/11683)): Fix `unknown font family` warnings, and wrong fonts, when a `font-family` list or brand typography uses a CSS generic family (`serif`, `sans-serif`, `monospace`, `cursive`, `fantasy`, `math`, `system-ui`, `ui-*`). Typst has no generic families, so each one is now replaced by the first installed font from a list of well-known candidates, and the keyword is no longer passed to Typst. No fonts are bundled.
- ([#14081](https://github.com/quarto-dev/quarto-cli/issues/14081)): Support `lof` and `lot` in Typst documents, which previously had no effect. The list titles follow `lang` and can be set with `crossref: lof-title` and `lot-title`.
- ([#14290](https://github.com/quarto-dev/quarto-cli/issues/14290)): Fix `proof`, `remark` and `solution` blocks in Typst output, which rendered as plain text and could not be cross-referenced. They now use the same frames as theorems. Theorem and proof titles set in the language files may now contain Typst markup characters. (author: @mcanouil)
- ([#14847](https://github.com/quarto-dev/quarto-cli/pull/14847)): Fix `toc_title` auto-fallback in typst outline template that was ignoring the computed fallback value when `toc_title` is `none`.
- ([#14947](https://github.com/quarto-dev/quarto-cli/issues/14947)): Fix Typst compilation failing with `invalid number suffix: px` when an image with alt text (`fig-alt`, `alt`, or an inline image caption) has its `width` or `height` in pixels. These images are now written by Pandoc's Typst writer like other images, which also fixes URL-encoded image paths and unsupported size units for them.

## Projects

### Books

- ([#10114](https://github.com/quarto-dev/quarto-cli/issues/10114)): Support `announcement` under the `book` key, which previously had no effect.
- ([#14276](https://github.com/quarto-dev/quarto-cli/issues/14276)): Support `llms-txt` under the `book` key, which previously had no effect.
- ([#14879](https://github.com/quarto-dev/quarto-cli/issues/14879)): Support `plausible-analytics`, `back-to-top-navigation`, and `image-alt` under the `book` key, which previously had no effect.
- ([#14929](https://github.com/quarto-dev/quarto-cli/pull/14929)): Fix `Error compiling template` when rendering a book to `pdf`, `docx` or `epub` on Windows with Quarto located under a directory whose name starts with `_`, `.`, `-` or another punctuation character.
- ([#14975](https://github.com/quarto-dev/quarto-cli/issues/14975)): Fix `llms-txt` in book projects showing unresolved cross-references (`Equation eq-one` instead of `Equation 1.1`) in the generated `.llms.md` pages.
- ([#15106](https://github.com/quarto-dev/quarto-cli/pull/15106)): Fix Google Scholar `citation_reference` metadata missing on the references page of an HTML book.

### Websites

- ([#10756](https://github.com/quarto-dev/quarto-cli/issues/10756)): Fix the notebook preview of an embedded `.qmd` file going missing from the output directory when a project is rendered again, which broke its source notebook link.
- ([#12014](https://github.com/quarto-dev/quarto-cli/issues/12014)): Fix `twitter-card` `image-width` and `image-height` being listed as options although Twitter Cards have no image size tags. They are no longer documented, and setting them prints a warning pointing to `open-graph`, where an image size is used. The size Quarto measures from a local image is no longer written as `twitter:image-height` and `twitter:image-width` tags, only as `og:image:height` and `og:image:width`.
- ([#12016](https://github.com/quarto-dev/quarto-cli/issues/12016)): Fix `open-graph` `image-width` and `image-height` being dropped when `site-url` is set and Quarto cannot measure the image, such as a remote image. A size declared in the site `open-graph` options no longer applies when a page sets its own `image`, even the same file: declare `image-width` and `image-height` in the page `open-graph` options or in shared metadata such as `_metadata.yml`.
- ([#14493](https://github.com/quarto-dev/quarto-cli/issues/14493)): Fix category links on a post going to the wrong listing when the post appears in more than one listing. (author: @mcanouil)
- ([#14917](https://github.com/quarto-dev/quarto-cli/issues/14917)): Fix `og:site_name` ignoring a page's `open-graph.site-name` and always showing the website title. Quarto also no longer rewrites `og:site_name`, `og:title`, `og:description`, `twitter:title` or `twitter:description` tags it did not write, such as ones added with `include-in-header` or by an extension. (author: @Masad791)
- ([#14972](https://github.com/quarto-dev/quarto-cli/issues/14972)): Fix the website navbar, sidebar toggle bar, or announcement covering the header of notebook preview pages, which hid the back link, notebook title, and download link. The notebook preview header now sits below the site header.
- ([#14974](https://github.com/quarto-dev/quarto-cli/issues/14974)): Fix math in `.llms.md` files from `llms-txt` coming out garbled with the default `mathjax` method, and with `katex` and `webtex`. Math is now written as `$...$` and `$$...$$` with the `mathjax`, `katex`, `webtex` and `mathml` methods.
- ([#15004](https://github.com/quarto-dev/quarto-cli/issues/15004)): Fix notebook preview pages and notebook sources missing from the output directory when a website with embedded notebooks is rendered from a directory other than the project directory.
- ([#15022](https://github.com/quarto-dev/quarto-cli/issues/15022)): Fix rendering a listing with a `feed` failing on Windows with `os error 123` when a listing item's `image` or the feed `image` is a web URL. The image URL is used as is in the feed and no local size lookup is attempted. (author: @Masad791)
- ([#15032](https://github.com/quarto-dev/quarto-cli/pull/15032)): Fix the listing feed `image` missing its height and width when a website is rendered from a directory other than the project directory, or when the image path starts with `/`.
- ([#15039](https://github.com/quarto-dev/quarto-cli/issues/15039)): Fix the open graph and twitter card image of website pages in subdirectories pointing to a missing file when the image comes from a relative `website: image:`, `open-graph: image:` or `twitter-card: image:` under `website:`, and the listing feed image pointing to a missing file when it comes from the `image` of a listing page in a subdirectory. A project relative image path starting with `/` no longer gives a doubled `/` in these URLs when `site-url` ends with `/`.
- ([#15044](https://github.com/quarto-dev/quarto-cli/issues/15044)): Fix a YAML file listed next to a folder in a listing's `contents` being left out, or another file being used, when a website is rendered from a directory other than the listing page's directory.
- ([#15050](https://github.com/quarto-dev/quarto-cli/pull/15050)): Support JPEG images when adding image height and width to the listing feed `image`, feed item media, and `og:image` metadata. Image files are now detected by content rather than file extension, so an uppercase `.PNG` is measured too.
- ([#15055](https://github.com/quarto-dev/quarto-cli/issues/15055)): Fix `og:image` and `twitter:image` of website pages using an inline data URI image, such as the ORCID badge of an author, joined to `site-url` instead of the next image of the page or the site `image`. A data URI set as a page, site or listing item `image` is now ignored with a warning for social metadata and listing feeds, as these images are fetched by URL, and listing cards show it as is.
- ([#15057](https://github.com/quarto-dev/quarto-cli/pull/15057)): Fix a numeric top-level `image-width` or `image-height` in page front matter failing the render. These options were never used, so they are removed from the schema; declare the preview image size under `open-graph` instead.
- ([#15083](https://github.com/quarto-dev/quarto-cli/pull/15083)): Fix editors offering no completion for the top-level `image-title` option that about pages read, and correct the description of the top-level `image-lazy-loading` option, which only affects the page's image when it appears in a listing.
- ([#15084](https://github.com/quarto-dev/quarto-cli/pull/15084)): Fix page-level `open-graph` and `twitter-card` options not being validated, which let a misspelled option be silently ignored and a value of the wrong type crash the render. These options are now checked like their `website` counterparts, so a page or `_metadata.yml` with an unknown option under `open-graph` or `twitter-card`, which was ignored before, now fails to render with an error naming the option.
- ([#15091](https://github.com/quarto-dev/quarto-cli/pull/15091)): Fix page-level `bread-crumbs`, `back-to-top-navigation`, `page-navigation`, `margin-header` and `margin-footer` options not being validated or offered for completion in editors. A page value of the wrong type now fails to render with an error instead of being accepted silently.
- ([#15091](https://github.com/quarto-dev/quarto-cli/pull/15091)): Fix `open-graph: false` or `twitter-card: false` in page front matter or `_metadata.yml` not disabling Open Graph or Twitter Card metadata for that page when the website enables it.
- ([#15114](https://github.com/quarto-dev/quarto-cli/pull/15114)): Fix a website category containing backticks showing broken text in the page title block, and a category containing a backslash, such as a Windows path, failing the render or losing its backslashes.

## Lua API

- ([#14894](https://github.com/quarto-dev/quarto-cli/pull/14894)): Fix `quarto.version` and `quarto.config.version()` crashing filters with `table expected, got string` when the version string contains semver build metadata (such as a distro packager's revision suffix) or otherwise does not start with a digit.

## Commands

### `call`

- ([#14815](https://github.com/quarto-dev/quarto-cli/pull/14815)): Add `quarto call axe`, a hidden experimental command that scans a rendered site for accessibility violations with axe-core across a page × viewport × color-mode matrix, groups them by root-cause signature, reconciles a committed baseline, and can gate CI with `--fail-on`. See [dev-docs/axe-scan.md](https://github.com/quarto-dev/quarto-cli/blob/main/dev-docs/axe-scan.md).

### `check`

- ([#14960](https://github.com/quarto-dev/quarto-cli/issues/14960)): Fix `quarto check` failing when the project contains a directory it cannot read, for example when a stray `_quarto.yml` in the home directory makes the home directory a project. `quarto check` now reads only the project configuration, without scanning input files or creating a `.quarto` directory in the project root. `quarto check info` reports the project root and the `_quarto.yml` that set it (`info.project` in `--output` JSON), and warns when the project root is the home directory or a filesystem root. `quarto render` and `quarto preview` now report an unreadable directory in the project as one error naming the directory, the project root and its `_quarto.yml`, instead of a raw `readdir` error with a stack trace.

### `use template`

- ([#14008](https://github.com/quarto-dev/quarto-cli/issues/14008)): Fix `quarto use template` not installing the template's extensions when they are scoped by organisation, such as `quarto-journals/acm`. (author: @mcanouil)

## Extensions

- ([#14254](https://github.com/quarto-dev/quarto-cli/issues/14254)): Fix `quarto render` hanging when the input file is at the filesystem root. (author: @mcanouil)
- ([#14936](https://github.com/quarto-dev/quarto-cli/pull/14936)): Accept and ignore static engine declaration keys (`name`, `claims`, `file-extensions`, `claims-files` — including an optional `processor` on `claims-files` entries) in the `external-engine` schema, so extensions can declare them for Quarto 2's engine resolution without breaking Quarto 1 validation. No Quarto 1 behavior change. (author: @gordonwoodhull)

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously they were ignored.

### `julia`

- ([#14834](https://github.com/quarto-dev/quarto-cli/issues/14834)): Fix `ERROR: Internal Error` when rendering documents whose payload exceeds the Julia server's socket send buffer.
- ([PumasAI/quarto-julia-engine#8](https://github.com/PumasAI/quarto-julia-engine/pull/8)): Support `keep-ipynb`, which writes the executed notebook to `<stem>.ipynb` alongside the source file.
- ([PumasAI/quarto-julia-engine#14](https://github.com/PumasAI/quarto-julia-engine/pull/14)): Fix the Julia worker process being left running after a failed render without an execution daemon.
- ([PumasAI/quarto-julia-engine#13](https://github.com/PumasAI/quarto-julia-engine/pull/13)): Shell (`;`), help (`?`), and Pkg (`]`) mode cells now work when the cell has `#|` options.
- ([PumasAI/quarto-julia-engine#11](https://github.com/PumasAI/quarto-julia-engine/pull/11)): Support `fig-format: retina`, normalized to `png` with doubled `fig-dpi` as in the `jupyter` and `knitr` engines.
- ([PumasAI/quarto-julia-engine#7](https://github.com/PumasAI/quarto-julia-engine/pull/7)): Support `execute-dir`, shared worker processes across notebooks with matching configs (`share_worker_process: true`).

### `jupyter`

- ([#13966](https://github.com/quarto-dev/quarto-cli/issues/13966)): Fix doubled newlines in HTML output of stdout and stderr containing ANSI escape codes.

## Other fixes and improvements

- ([#9864](https://github.com/quarto-dev/quarto-cli/issues/9864), [#11139](https://github.com/quarto-dev/quarto-cli/issues/11139)): Fix metadata defined both in a document's front matter and in `_quarto.yml`, a directory `_metadata.yml` or `metadata-files` reaching Pandoc templates and Lua filters with only the document's values. The values are now merged, and the document's values still take precedence for single values. Lists are combined instead of replaced, so a document can no longer drop entries that the project, a directory `_metadata.yml` or `metadata-files` add to a list such as `keywords`. (author: @jkrumbiegel)
- ([#14765](https://github.com/quarto-dev/quarto-cli/issues/14765)): Fix content after a `mermaid` diagram disappearing, and `ojs` cells after it not running, when the diagram has its own `---` configuration block. (author: @mcanouil)
- ([#14775](https://github.com/quarto-dev/quarto-cli/issues/14775)): Fix a crash when the `QUARTO_R` environment variable is set to a malformed path. Quarto now warns and falls back to other R lookup methods.
- ([#14865](https://github.com/quarto-dev/quarto-cli/issues/14865)): Fix internal links in a preview being treated as external when the preview is reached through a proxy, such as on Posit Workbench. Links are now classified against the origin the browser sees.
- ([#14878](https://github.com/quarto-dev/quarto-cli/pull/14878)): Add `az` (Azerbaijani) language translation. (author: @abdanar)
- ([#14983](https://github.com/quarto-dev/quarto-cli/issues/14983)): Fix `quarto render` treating a parent folder as a Hugo project when its `config/` folder can't be entered, which silently wrote `hugo-md` output or failed with a permission error. (author: @pinin4fjords)
- ([#15097](https://github.com/quarto-dev/quarto-cli/pull/15097)): Fix the `.content-hidden unless-profile` attribute completion inserting invalid syntax (its `=` was missing), and typos in three attribute completion descriptions. (author: @rkskmt)
