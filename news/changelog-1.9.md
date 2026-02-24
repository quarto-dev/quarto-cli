All changes included in 1.9:

## Shortcodes

- ([#13342](https://github.com/quarto-dev/quarto-cli/issues/13342)): Ensure that the `contents` shortcode works inside metadata.
- ([#13489](https://github.com/quarto-dev/quarto-cli/issues/13489)): Add `mode=plain` option to the `kbd` shortcode to render keyboard shortcuts exactly as written, without OS-specific symbol translation.
- ([#14061](https://github.com/quarto-dev/quarto-cli/issues/14061)): Fix `meta` shortcode not preserving line breaks in values. The shortcode now respects its usage context (block, inline, or text) and preserves paragraph breaks in block and code block contexts.

## Regression fixes

- ([#13396](https://github.com/quarto-dev/quarto-cli/issues/13396)): Fix `quarto publish connect` regression.
- ([#13441](https://github.com/quarto-dev/quarto-cli/pull/13441)): Catch `undefined` exceptions in Pandoc failure to avoid spurious error message.
- ([#13046](https://github.com/quarto-dev/quarto-cli/issues/13046)): Use new url for multiplex socket.io server <https://multiplex.up.railway.app/> as default for `format: revealjs` and `revealjs.multiplex: true`.
- ([#13506](https://github.com/quarto-dev/quarto-cli/issues/13506)): Fix navbar active state detection when sidebar has no logo configured. Prevents empty logo links from interfering with navigation highlighting.
- ([#13616](https://github.com/quarto-dev/quarto-cli/issues/13616)): Fix fatal error when rendering manuscript projects with custom blocks like ConditionalBlock.
- ([#13625](https://github.com/quarto-dev/quarto-cli/issues/13625)): Fix Windows file locking error (os error 32) when rendering with `--output-dir` flag. Context cleanup now happens before removing the temporary `.quarto` directory, ensuring file handles are properly closed.
- ([#13633](https://github.com/quarto-dev/quarto-cli/issues/13633)): Fix detection and auto-installation of babel language packages from newer error format that doesn't explicitly mention `.ldf` filename.
- ([#13694](https://github.com/quarto-dev/quarto-cli/issues/13694)): Fix `notebook-view.url` being ignored - external notebook links now properly use specified URLs instead of local preview files.
- ([#13732](https://github.com/quarto-dev/quarto-cli/issues/13732)): Fix automatic font package installation for fonts with spaces in their names (e.g., "Noto Emoji", "DejaVu Sans"). Font file search patterns now match both with and without spaces.

## Dependencies

- Update `pandoc` to 3.8.3
  - ([#13925](https://github.com/quarto-dev/quarto-cli/issues/13925)): Pandoc 3.8.3 introduces `^[text]^` as inline footnote syntax. This conflicts with superscript containing a Span at the start (e.g., `^[text]{.class}^`) since the `^[` sequence now triggers footnote parsing. A workaround is to insert a zero-width space or other invisible character between `^` and `[`.
- Update `typst` to 0.14.2
- Update `esbuild` to 0.25.10
- Update `deno` to 2.4.5
- ([#13601](https://github.com/quarto-dev/quarto-cli/pull/13601)): Update `mermaid` to 11.12.0 (author: @multimeric)

## Formats

### All Formats

- ([#13878](https://github.com/quarto-dev/quarto-cli/issues/13878)): Add `syntax-highlighting` option replacing the deprecated `highlight-style` in Pandoc 3.8. It supports style names (e.g., `tango`, `github`), custom `.theme` files, `none` to disable highlighting, or `idiomatic` for native format highlighting. The `highlight-style` option remains supported but is deprecated.

### `gfm`

- ([#13421](https://github.com/quarto-dev/quarto-cli/issues/13421)): Do not word-wrap titles in header.
- ([#13603](https://github.com/quarto-dev/quarto-cli/issues/13603)): Fix callouts with title but no body content causing fatal error when rendering to GitHub Flavored Markdown.

### `email`

- ([#13882](https://github.com/quarto-dev/quarto-cli/pull/13882)): Add support for multiple email outputs when rendering to `format: email` for Posit Connect.
- ([#14021](https://github.com/quarto-dev/quarto-cli/issues/14021)): Add `email-version` hook to override detected Connect version when rendering emails for Posit Connect.

### `html`

- ([#11929](https://github.com/quarto-dev/quarto-cli/issues/11929)): Import all `brand.typography.fonts` in CSS, whether or not fonts are referenced by typography elements.
- ([#13413](https://github.com/quarto-dev/quarto-cli/issues/13413)): Fix uncentered play button in `video` shortcodes from cross-reference divs. (author: @bruvellu)
- ([#13508](https://github.com/quarto-dev/quarto-cli/issues/13508)): Add `aria-label` support to `video` shortcode for improved accessibility.
- ([#13685](https://github.com/quarto-dev/quarto-cli/issues/13685)): Fix remote font URLs in brand extensions being incorrectly joined with the extension path, resulting in broken font imports.
- ([#13825](https://github.com/quarto-dev/quarto-cli/issues/13825)): Fix `column: margin` not working with `renderings: [light, dark]` option. Column classes are now preserved when applying theme classes to cell outputs.
- ([#13883](https://github.com/quarto-dev/quarto-cli/issues/13883)): Fix unequal top/bottom spacing in simple untitled callouts.
- ([#13900](https://github.com/quarto-dev/quarto-cli/issues/13900)): Warn when `renderings` cell option contains duplicate names. Previously, duplicate names like `[dark, light, dark, light]` would silently use only the last output for each name.
- ([#14065](https://github.com/quarto-dev/quarto-cli/issues/14065)): Fix `SCSSParsingError` when custom SCSS themes contain non-ASCII characters in selectors (e.g., `#présentation`).

### `typst`

- ([#13362](https://github.com/quarto-dev/quarto-cli/issues/13362)): Remove unused `blockquote` definitions from template.
- ([#13452](https://github.com/quarto-dev/quarto-cli/issues/13452)): Wraps subfigure captions generated by `quarto_super()` in `block` function to avoid emitting `par` elements. (author: @christopherkenny)
- ([#13474](https://github.com/quarto-dev/quarto-cli/issues/13474)): Heading font for title should default to `mainfont`.
- ([#13555](https://github.com/quarto-dev/quarto-cli/issues/13555)): Add support for `icon=false` in callouts when used in `format: typst`.
- ([#13589](https://github.com/quarto-dev/quarto-cli/issues/13589)): Fix callouts with invalid ID prefixes crashing with "attempt to index a nil value". Callouts with unknown reference types now render as non-crossreferenceable callouts with a warning, ignoring the invalid ID.
- ([#13602](https://github.com/quarto-dev/quarto-cli/issues/13602)): Fix support for multiple files set in `bibliography` field in `biblio.typ` template partial.
- ([#13745](https://github.com/quarto-dev/quarto-cli/issues/13745)): Fix relative `font-paths` from extensions or document metadata not resolving correctly for Typst compilation. Relative paths are now resolved against the document directory before being passed to the Typst CLI.
- ([#13775](https://github.com/quarto-dev/quarto-cli/issues/13775)): Fix brand fonts not being applied when using `citeproc: true` with Typst format. Format detection now properly handles Pandoc format variants like `typst-citations`.
- ([#13868](https://github.com/quarto-dev/quarto-cli/issues/13868)): Add image alt text support for PDF/UA accessibility. Alt text from markdown captions and explicit `alt` attributes is now passed to Typst's `image()` function. (Temporary workaround until [jgm/pandoc#11394](https://github.com/jgm/pandoc/pull/11394) is merged.)
- ([#13917](https://github.com/quarto-dev/quarto-cli/issues/13917)): Fix brand logo paths not resolving correctly for Typst documents in project subdirectories. Brand logo paths are now converted to project-absolute paths before merging with document metadata, replacing the fragile `projectOffset()` workaround.
- ([#13249](https://github.com/quarto-dev/quarto-cli/pull/13249)): Update to Pandoc's Typst template following Pandoc 3.8.3 and Typst 0.14.2 support:
  - Code syntax highlighting now uses Skylighting by default.
  - New template variables `mathfont`, `codefont`, and `linestretch` for font and line spacing customization.
  - New template variables `linkcolor`, `citecolor`, and `filecolor` for link color customization.
  - New template variable `thanks` for title footnote acknowledgment.
  - New template variable `abstract-title` for abstract header customization.
  - PDF accessibility metadata: document title, author, and keywords are now set for PDF readers.
  - Two-column layout now uses `set page(columns:)` instead of `columns()` function, fixing compatibility with landscape sections.
  - Title block now properly spans both columns in multi-column layouts.
- ([#13870](https://github.com/quarto-dev/quarto-cli/issues/13870)): Add support for `alt` attribute on cross-referenced equations for improved accessibility. (author: @mcanouil)
- ([#13942](https://github.com/quarto-dev/quarto-cli/issues/13942)): Fix Typst compilation errors showing confusing internal stack traces. Users now see only the relevant Typst error message.
- ([#13950](https://github.com/quarto-dev/quarto-cli/pull/13950)): Replace ctheorems with theorion package for theorem environments. Add `theorem-appearance` option to control styling: `simple` (default, classic LaTeX style), `fancy` (colored boxes with brand colors), `clouds` (rounded backgrounds), or `rainbow` (colored start border and colored title).
- ([#13954](https://github.com/quarto-dev/quarto-cli/issues/13954)): Add support for Typst book projects via format extensions. Quarto now bundles the `orange-book` extension which provides a textbook-style format with chapter numbering, cross-references, and professional styling. Book projects with `format: typst` automatically use this extension.
- ([#13978](https://github.com/quarto-dev/quarto-cli/pull/13978)): Keep term and description together in definition lists to avoid breaking across pages. (author: @mcanouil)
- ([#13878](https://github.com/quarto-dev/quarto-cli/issues/13878)): Typst now uses Pandoc's skylighting for syntax highlighting by default (consistent with other formats). Use `syntax-highlighting: idiomatic` to opt-in to Typst's native syntax highlighting instead.

### `pdf`

- ([#4426](https://github.com/quarto-dev/quarto-cli/issues/4426)): Add `pdf-standard` option for PDF/A, PDF/UA, and PDF version control. Supports standards like `a-2b`, `ua-1`, and versions `1.7`, `2.0`. Works with both LaTeX and Typst formats.
- ([#10291](https://github.com/quarto-dev/quarto-cli/issues/10291)): Fix detection of babel hyphenation warnings with straight-quote format instead of backtick-quote format.
- ([#13248](https://github.com/quarto-dev/quarto-cli/issues/13248)): Fix image alt text not being passed to LaTeX `\includegraphics[alt={...}]` for PDF accessibility. Markdown image captions and `fig-alt` attributes are now preserved for PDF/UA compliance.
- ([#13661](https://github.com/quarto-dev/quarto-cli/issues/13661)): Fix LaTeX compilation errors when using `mermaid-format: svg` with PDF/LaTeX output. SVG diagrams are now written directly without HTML script tags. Note: `mermaid-format: png` is recommended for best compatibility. SVG format requires `rsvg-convert` (or Inkscape with `use-rsvg-convert: false`) in PATH for conversion to PDF, and may experience text clipping in diagrams with multi-line labels.
- ([rstudio/tinytex-releases#49](https://github.com/rstudio/tinytex-releases/issues/49)): Fix detection of LuaTeX-ja missing file errors by matching both "File" and "file" in error messages.
- ([#13667](https://github.com/quarto-dev/quarto-cli/issues/13667)): Fix LaTeX compilation error with Python error output containing caret characters.
- ([#13730](https://github.com/quarto-dev/quarto-cli/issues/13730)): Fix TinyTeX detection when `~/.TinyTeX/` directory exists without binaries. Quarto now verifies that the bin directory and tlmgr binary exist before reporting TinyTeX as available, allowing proper fallback to system PATH installations.
- ([#13919](https://github.com/quarto-dev/quarto-cli/issues/13919)): Fix margin citations with citeproc showing unresolved `?quarto-cite:` placeholders in PDF output. Caused by Pandoc 3.6+ adding `\protect` before `\phantomsection` in bibliography anchors.
- ([#13249](https://github.com/quarto-dev/quarto-cli/pull/13249)): Update to Pandoc's LaTeX template following Pandoc 3.8.3 support:
  - New RTL support for LuaTeX with `\RL`, `\LR` commands and `RTL`, `LTR` environments.
  - New `shorthands` variable for Babel language shortcuts control.
  - New `pdf-trailer-id` support for reproducible PDF builds.
  - New `cancel` package support for `\cancel` command in math.
- ([#14017](https://github.com/quarto-dev/quarto-cli/issues/14017)): `tColorOptions()` in .tex file will now always have options in alphabetical order. Previously, they were in random order leading to a different .tex intermediates for identical .qmd.

### `revealjs`

- ([#13722](https://github.com/quarto-dev/quarto-cli/issues/13722)): Fix `light-content` / `dark-content` SCSS rules not included in Reveal.js format. (author: @mcanouil)
- ([#13852](https://github.com/quarto-dev/quarto-cli/issues/13852)): Scroll-view options (`scrollSnap`, `scrollProgress`, `scrollActivationWidth`, `scrollLayout`) are now rendered in the Pandoc template instead of injected at runtime. Custom revealjs templates may need updating to include the scroll-view configuration block.

### `ipynb`

- ([#13956](https://github.com/quarto-dev/quarto-cli/issues/13956)): Fix crash when rendering to `ipynb` format with figure labels (`#| label: fig-*`) on cells for cross references.

## Projects

- ([#12444](https://github.com/quarto-dev/quarto-cli/pull/12444)): Improve pre/post render script logging with `Running script` prefix and add `QUARTO_PROJECT_SCRIPT_PROGRESS` and `QUARTO_PROJECT_SCRIPT_QUIET` environment variables so scripts can adapt their output.
- ([#13892](https://github.com/quarto-dev/quarto-cli/issues/13892)): Fix `output-dir: ./` deleting entire project directory. `output-dir` must be a subdirectory of the project directory and check is now better to avoid deleting the project itself when it revolves to the same path.

### `website`

- ([#13524](https://github.com/quarto-dev/quarto-cli/issues/13524)): Add support for Plausible Analytics via `plausible-analytics` configuration option. Users can either paste their Plausible script snippet directly in YAML or provide a path to a file containing the snippet using `plausible-analytics: { path: _plausible_snippet.html }`.
- ([#13525](https://github.com/quarto-dev/quarto-cli/issues/13525)): Algolia Insights now uses privacy-friendly defaults: `useCookie: false` with random session tokens when cookie consent is not configured. When `cookie-consent: true` is enabled, Algolia scripts are deferred and only use cookies after user grants "tracking" consent, ensuring GDPR compliance.
- ([#13547](https://github.com/quarto-dev/quarto-cli/issues/13547))`cookie-content: { type: express }` is now the default. Previously it was `type: implied`. It now means this will block cookies until the user expressly agrees to allow them (or continue blocking them if the user doesn't agree).
- ([#13570](https://github.com/quarto-dev/quarto-cli/pull/13570)): Replace Twitter with Bluesky in default blog template and documentation examples. New blog projects now include Bluesky social links instead of Twitter.
- ([#13716](https://github.com/quarto-dev/quarto-cli/issues/13716)): Fix draft pages showing blank during preview when pre-render scripts are configured.
- ([#13847](https://github.com/quarto-dev/quarto-cli/pull/13847)): Open graph title with markdown is now processed correctly. (author: @mcanouil)
- ([#13910](https://github.com/quarto-dev/quarto-cli/issues/13910)): Add support for `logo: false` to disable sidebar and navbar logos when using `_brand.yml`. Works in website projects (`sidebar.logo: false`, `navbar.logo: false`) and book projects (`book.sidebar.logo: false`, `book.navbar.logo: false`).
- ([#13932](https://github.com/quarto-dev/quarto-cli/pull/13932)): Add `llms-txt: true` option to generate LLM-friendly content for websites. Creates `.llms.md` markdown files alongside HTML pages and a root `llms.txt` index file following the [llms.txt](https://llmstxt.org/) specification.
- ([#13951](https://github.com/quarto-dev/quarto-cli/issues/13951)): Fix `image-lazy-loading` not applying `loading="lazy"` attribute to auto-detected listing images.
- ([#14003](https://github.com/quarto-dev/quarto-cli/pull/14003)): Add text fragments to search result links so browsers scroll to and highlight the matched text on the target page.
- ([#9802](https://github.com/quarto-dev/quarto-cli/issues/9802), [#14047](https://github.com/quarto-dev/quarto-cli/issues/14047)): Fix search term highlighting disappearing on page scroll or layout events when navigating from search results. (author: @jtbayly, [#13442](https://github.com/quarto-dev/quarto-cli/pull/13442))

### `book`

- ([#13769](https://github.com/quarto-dev/quarto-cli/issues/13769)): Apply `repo-link-target` and `repo-link-rel` options to tools in book sidebar for consistent link attribute handling with website projects. (author: @mcanouil)

### `manuscript`

- ([#10031](https://github.com/quarto-dev/quarto-cli/issues/10031)): Fix manuscript rendering prompting for GitHub credentials when origin points to private repository. Auto-detection of manuscript URL now fails gracefully with a warning instead of blocking renders.

## Publishing

### Posit Connect Cloud

- ([#14027](https://github.com/quarto-dev/quarto-cli/issues/14027)): Add `quarto publish posit-connect-cloud` for publishing static content to Posit Connect Cloud.

### Confluence

- ([#12558](https://github.com/quarto-dev/quarto-cli/issues/12558)): Fix 500 error when updating multiple Confluence attachments. Attachments are now uploaded sequentially instead of concurrently. (author: @fkgruber)
- ([#13414](https://github.com/quarto-dev/quarto-cli/issues/13414)): Be more forgiving when Confluence server returns malformed JSON response. (author: @m1no)

### `gh-pages`

- ([#14046](https://github.com/quarto-dev/quarto-cli/issues/14046)): Fix `quarto publish gh-pages` leaving stale worktrees when `git commit` fails due to missing `user.name`/`user.email` configuration. Git identity is now validated before worktree creation, and worktree cleanup uses `--force` to handle modified/untracked files.

## Lua API

- ([#13762](https://github.com/quarto-dev/quarto-cli/issues/13762)): Add `quarto.paths.typst()` to Quarto's Lua API to resolve Typst binary path in Lua filters and extensions consistently with Quarto itself. (author: @mcanouil)

## Commands

### `use brand`

- ([#13828](https://github.com/quarto-dev/quarto-cli/pull/13828)): New `quarto use brand` command copies and synchronizes the `_brand/` directory from a repo, directory, or ZIP file. See [the prerelease documentation](https://prerelease.quarto.org/docs/authoring/brand.html#quarto-use-brand) for details.

### `call build-ts-extension`

- (): New `quarto call build-ts-extension` command builds a TypeScript extension, such as an engine extension, and places the artifacts in the `_extensions` directory. See the [engine extension pre-release documentation](https://prerelease.quarto.org/docs/extensions/engine.html) for details.

### `install`

- ([#4426](https://github.com/quarto-dev/quarto-cli/issues/4426)): New `quarto install verapdf` command installs [veraPDF](https://verapdf.org/) for PDF/A and PDF/UA validation. When verapdf is available, PDFs created with the `pdf-standard` option are automatically validated for compliance. Also supports `quarto uninstall verapdf`, `quarto update verapdf`, and `quarto tools`.
- ([#11877](https://github.com/quarto-dev/quarto-cli/issues/11877), [#10961](https://github.com/quarto-dev/quarto-cli/issues/10961), [#6821](https://github.com/quarto-dev/quarto-cli/issues/6821), [#13704](https://github.com/quarto-dev/quarto-cli/issues/13704)): New `quarto install chrome-headless-shell` command downloads [Chrome Headless Shell](https://developer.chrome.com/blog/chrome-headless-shell) from Google's Chrome for Testing API. This is the recommended headless browser for diagram rendering (Mermaid, Graphviz) to non-HTML formats. Smaller and lighter than full Chrome, with fewer system dependencies.

### `preview`

- ([#13804](https://github.com/quarto-dev/quarto-cli/pull/13804)): Fix intermittent preview crashes during re-renders by properly managing project context lifecycle. Resolves issues with missing temporary directories and `quarto_ipynb` files when editing notebooks and qmd files together.

## Extensions

- Metadata and brand extensions now work without a `_quarto.yml` project. (Engine extensions do too.) A temporary default project is created in memory.

- New **Engine Extensions**, to allow other execution engines than knitr, jupyter, julia. Julia is now a bundled extension. See [the prerelease notes](https://prerelease.quarto.org/docs/prerelease/1.9/) and [engine extension documentation](https://prerelease.quarto.org/docs/extensions/engine.html).

## Engines

### `jupyter`

- ([#13748](https://github.com/quarto-dev/quarto-cli/pull/13748)): Fix stdin encoding to UTF-8 on Windows to correctly handle JSON in documents containing non-ASCII characters.
- ([#13936](https://github.com/quarto-dev/quarto-cli/pull/13936)): Add support for q/kdb+ programming language in percent format notebooks and code cell options. (author: @benlubas)
- ([#13936](https://github.com/quarto-dev/quarto-cli/pull/13936)): Fix `isJupyterPercentScript` regex to correctly detect percent scripts with `[raw]` cells and cells not at the start of the file. The regex now properly groups the alternation `(markdown|raw)` and uses multiline mode.

### `knitr`

- ([#13958](https://github.com/quarto-dev/quarto-cli/issues/13958)): Use max precision for `ojs_define` number like this is the case for `jupyter` or `julia` engine.

## Other fixes and improvements

- ([#8730](https://github.com/quarto-dev/quarto-cli/issues/8730)): Detect x64 R crashes on Windows ARM and provide helpful error message directing users to install native ARM64 R instead of showing generic "check your R installation" error.
- ([#13402](https://github.com/quarto-dev/quarto-cli/issues/13402)): `nfpm` (<https://nfpm.goreleaser.com/>) is now used to create the `.deb` package, and new `.rpm` package. Both Linux packages are also now built for `x86_64` (`amd64`) and `aarch64` (`arm64`) architectures.
- ([#13528](https://github.com/quarto-dev/quarto-cli/pull/13528)): Adds support for table specification using nested lists and the `list-table` class.
- ([#13575](https://github.com/quarto-dev/quarto-cli/pull/13575)): Improve CPU architecture detection/reporting in macOS to allow quarto to run in virtualized environments such as OpenAI's `codex`.
- ([#13656](https://github.com/quarto-dev/quarto-cli/issues/13656)): Fix R code cells with empty `lang: ""` option producing invalid markdown class attributes.
- ([#13776](https://github.com/quarto-dev/quarto-cli/issues/13776)): Do not process tblwidths attributes for non-simple tables, since this breaks rowspan handling.
- ([#13832](https://github.com/quarto-dev/quarto-cli/pull/13832)): Fix `license.text` metadata not being accessible when using an inline license (`license: "text"`), and populate it with the license name for CC licenses instead of empty string. (author: @mcanouil)
- ([#13856](https://github.com/quarto-dev/quarto-cli/issues/13856)): Add code annotation support for Typst and Observable.js code blocks. (author: @mcanouil)
- ([#13890](https://github.com/quarto-dev/quarto-cli/issues/13890)): Fix render failure when using `embed-resources: true` with input path through a symlinked directory. The cleanup now resolves symlinks before comparing paths.
- ([#13907](https://github.com/quarto-dev/quarto-cli/issues/13907)): Ignore AI assistant configuration files (`CLAUDE.md`, `AGENTS.md`) when scanning for project input files and in extension templates, similar to how `README.md` is handled.
- ([#13935](https://github.com/quarto-dev/quarto-cli/issues/13935)): Fix `quarto install`, `quarto update`, and `quarto uninstall` interactive tool selection.
- ([#13992](https://github.com/quarto-dev/quarto-cli/issues/13992)): Fix crash when rendering div with both cross-reference ID and conditional visibility to PDF.
- ([#13997](https://github.com/quarto-dev/quarto-cli/issues/13997)): Fix Windows dart-sass theme compilation failing when Quarto is installed in a path with spaces (e.g., `C:\Program Files\`) and the project path also contains spaces.
- ([#13998](https://github.com/quarto-dev/quarto-cli/issues/13998)): Fix YAML validation error with CR-only line terminators (old Mac format). Documents using `\r` line endings no longer fail with "Expected YAML front matter to contain at least 2 lines".
- ([#14012](https://github.com/quarto-dev/quarto-cli/issues/14012)): Add `fr-CA` language translation for Quebec French inclusive writing conventions, using parenthetical forms instead of middle dots for author labels. (author: @tdhock)
- ([#14032](https://github.com/quarto-dev/quarto-cli/issues/14032)): Add `editor_options` with `chunk_output_type` to YAML schema for autocompletion and validation in RStudio and Positron.
