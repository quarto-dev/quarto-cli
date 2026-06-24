All changes included in 1.10:

## Regression fixes

- ([#14267](https://github.com/quarto-dev/quarto-cli/issues/14267)): Fix Windows paths with accented characters (e.g., `C:\Users\Sébastien\`) breaking dart-sass compilation.
- ([#14281](https://github.com/quarto-dev/quarto-cli/issues/14281)): Fix transient `.quarto_ipynb` files accumulating during `quarto preview` with Jupyter engine.
- ([#14298](https://github.com/quarto-dev/quarto-cli/issues/14298)): Fix `quarto preview` browse URL including output filename (e.g., `hello.html`) for single-file documents, breaking Posit Workbench proxied server access.
- ([#14489](https://github.com/quarto-dev/quarto-cli/issues/14489)): Restore `--output-dir` support for `quarto preview` of single files when no `_quarto.yml` is present (e.g. R-package workspaces). Regression introduced in v1.9.18.
- ([rstudio/rstudio#17333](https://github.com/rstudio/rstudio/issues/17333)): Fix `quarto inspect` on standalone files emitting project metadata that breaks RStudio's publishing wizard.

## Dependencies

- ([#14291](https://github.com/quarto-dev/quarto-cli/issues/14291)): Update `deno` to v2.7.14 (fixes silent crash on Windows builds older than 16299).

## Accessibility

- ([#14468](https://github.com/quarto-dev/quarto-cli/issues/14468)): The `axe` accessibility report UI (HTML overlay, revealjs report slide, dashboard offcanvas) now uses its own theme-independent colors instead of inheriting from `brand` or theme. Keeps the report readable regardless of page styling, and stops `axe` from clobbering brand colors set via `_brand.yml`.
- ([#14604](https://github.com/quarto-dev/quarto-cli/issues/14604)): The `axe` accessibility report UI  now shows each violation's WCAG conformance level (e.g. `WCAG 2.0 AA (1.4.3)`) or `Best Practice`, derived from the violation's axe-core tags.

## Formats

### All Formats

- ([#14530](https://github.com/quarto-dev/quarto-cli/pull/14530)): Add `quarto.*` Pandoc template variable namespace. `format.language` is now exposed as `$quarto.language.<key>$` in custom Pandoc templates via the defaults-file `variables:` section, with no leakage into rendered output.

### `pdf`

- ([#13588](https://github.com/quarto-dev/quarto-cli/issues/13588)): Fix Lua error when rendering PDF with `reference-location: margin` and a footnote alongside a figure with `fig-cap`. (author: @mcanouil)
- ([#14553](https://github.com/quarto-dev/quarto-cli/issues/14553)): Fix font fallbacks (`mainfontfallback`, `sansfontfallback`, `monofontfallback`) crashing LuaLaTeX on TeX Live 2026 (luaotfload v3.29+) instead of filling in missing glyphs. Bare fallback names (e.g. `"DejaVu Sans"`) are now automatically colon-terminated as luaotfload requires; names that already carry a terminator or feature options (e.g. `"FreeSans:"`, `"Noto:mode=harf"`) are left untouched. A clear, actionable error is also reported if a fallback crash is still detected.
- ([#14553](https://github.com/quarto-dev/quarto-cli/issues/14553), [#14558](https://github.com/quarto-dev/quarto-cli/issues/14558)): Fix PDF render failing instead of auto-installing a missing font referenced by `monofontfallback` (and other `mainfont`/`sansfont`/`monofont` fallbacks).

### `typst`

- ([#12556](https://github.com/quarto-dev/quarto-cli/issues/12556)): Filter unavailable fonts from CSS `font-family` fallback lists before passing them to Typst, suppressing `unknown font family` warnings from Typst 1.12+ for fonts not installed locally. Available fonts are enumerated via `typst fonts` and cached per project.
- ([#14261](https://github.com/quarto-dev/quarto-cli/issues/14261)): Fix theorem/example block titles containing inline code producing invalid Typst markup when syntax highlighting is applied.
- ([#14460](https://github.com/quarto-dev/quarto-cli/issues/14460)): Fix CSS `border` and `border-color` declarations losing tokens that precede an `rgb()`/`rgba()` color (e.g. `border: 0px solid rgb(255, 0, 0)` rendering as a 2.25pt border instead of being suppressed). Also fixes: `var(--brand-NAME)` references crashing the Typst CSS translator when `NAME` contained digits (e.g. `--brand-red-50`); a crash when an `rgba()` alpha is unparseable; the `dvmin` length unit being silently rejected (a stray space in the unit table); CSS keywords like `BOLD` not matching as `bold` (CSS keywords are case-insensitive); invalid hex colors like `#fffff` being silently accepted as 2-component colors.
- ([#14511](https://github.com/quarto-dev/quarto-cli/issues/14511)): Fix brand fonts downloaded for a Typst book project not being passed to `typst compile`, causing `unknown font family` warnings and fallback to Libertinus Serif.
- ([#14524](https://github.com/quarto-dev/quarto-cli/issues/14524), [quarto-ext/orange-book#4](https://github.com/quarto-ext/orange-book/pull/4)): Fix orange-book Typst book running header not honoring `lang:` — chapter heading band stayed `Chapter N.` instead of the locale's word (e.g. `Chapitre N.` for `lang: fr`). Also fixes the orange-book `list-of-figure-title` / `list-of-table-title` template pipes which were silently rendering as empty strings. Consumes the `$quarto.language.*$` template-variable namespace from [#14530](https://github.com/quarto-dev/quarto-cli/pull/14530).

### `revealjs`

- ([#14354](https://github.com/quarto-dev/quarto-cli/pull/14354)): Fix trailing whitespace after author name on title slide when ORCID is not set. (author: @jnkatz)
- ([#14585](https://github.com/quarto-dev/quarto-cli/issues/14585)): Fix empty blockquote (`> `) crashing render for revealjs format.

## Projects

### Websites

- ([#13565](https://github.com/quarto-dev/quarto-cli/issues/13565), [#14353](https://github.com/quarto-dev/quarto-cli/issues/14353)): Fix sidebar logo not appearing on secondary sidebars in multi-sidebar website layouts.
- ([#14562](https://github.com/quarto-dev/quarto-cli/issues/14562)): Fix a heading inside `content-hidden when-format="llms-txt"` (visible in HTML) losing its `<section>` wrapper and `id` in a website with `llms-txt` enabled, which broke its table-of-contents link, anchors, and cross-references.
- ([#14563](https://github.com/quarto-dev/quarto-cli/issues/14563)): Fix a fatal error when a shortcode is used inside conditional content (e.g. `content-visible when-format="llms-txt"`) in a website with `llms-txt` enabled.

## Commands

### `quarto preview`

- ([#10392](https://github.com/quarto-dev/quarto-cli/issues/10392)): Fix `quarto preview` of a website or book project showing stale HTML for non-index pages after editing the source `.qmd`.
- ([#14281](https://github.com/quarto-dev/quarto-cli/issues/14281)): Avoid creating a duplicate `.quarto_ipynb` file on preview startup for single-file Jupyter documents.
- ([#14533](https://github.com/quarto-dev/quarto-cli/issues/14533)): Fix `quarto preview` not detecting a frontmatter `format:` change until the second render request. The first request after the edit now correctly restarts the preview process with the new format.
- ([#14593](https://github.com/quarto-dev/quarto-cli/issues/14593)): Fix `quarto preview` ignoring a `_brand.yml` added or removed while the preview is running. The brand change is now applied on the next render instead of requiring a preview restart.

### `install`

- ([#14304](https://github.com/quarto-dev/quarto-cli/issues/14304)): Fix `quarto install tinytex` silently ignoring extraction failures. When archive extraction fails (e.g., `.tar.xz` on a system without `xz-utils`), the installer now reports a clear error instead of proceeding and failing with a confusing `NotFound` message.
- ([#11877](https://github.com/quarto-dev/quarto-cli/issues/11877), [#9710](https://github.com/quarto-dev/quarto-cli/issues/9710)): Add arm64 Linux support for `quarto install chrome-headless-shell` using Playwright CDN as download source, since Chrome for Testing has no arm64 Linux builds.
- ([#11877](https://github.com/quarto-dev/quarto-cli/issues/11877)): Deprecate `quarto install chromium` — the command now transparently redirects to `chrome-headless-shell`. Installing `chrome-headless-shell` automatically removes any legacy Chromium installation. Use `chrome-headless-shell` instead, which always installs the latest stable Chrome (the legacy `chromium` installer pins an outdated Puppeteer revision that cannot receive security updates).
- ([#14363](https://github.com/quarto-dev/quarto-cli/pull/14363)): Add retry logic for tool downloads to handle transient network failures (connection resets, CDN timeouts) during `quarto install`.
- ([#14538](https://github.com/quarto-dev/quarto-cli/pull/14538)): `quarto install tinytex` and `quarto update tinytex` now set the TeX Live repository to the TinyTeX CDN-backed mirror at <https://tlnet.yihui.org> when reachable, falling back to `mirror.ctan.org`'s automatic redirect and the existing US university mirrors otherwise. Matches the default in the [R tinytex package](https://github.com/rstudio/tinytex) since March 2026. Override the resolved repository with the `QUARTO_TINYTEX_REPOSITORY` environment variable, or with `CTAN_REPO` (also honored for parity with the R [tinytex](https://github.com/rstudio/tinytex) package). See <https://yihui.org/en/2026/03/tinytex-ctan-mirror/> for background.

### `check`

- ([#11877](https://github.com/quarto-dev/quarto-cli/issues/11877)): `quarto check install` now shows a deprecation warning when legacy Chromium (installed via `quarto install chromium`) is detected, directing users to install `chrome-headless-shell` as a replacement.

### `quarto create`

- ([#14250](https://github.com/quarto-dev/quarto-cli/issues/14250)): Fix `quarto create` producing read-only files when Quarto is installed via system packages (e.g., `.deb`). Files copied from installed resources now have user-write permission ensured.

## Lua API

- ([#14297](https://github.com/quarto-dev/quarto-cli/pull/14297)): Fix `quarto.utils.is_empty_node()` returning inverted results for text nodes (`Str`, `Code`, `RawInline`).

## Engines

### Jupyter

- ([#13582](https://github.com/quarto-dev/quarto-cli/pull/13582)): Fix `application/pdf` and `text/latex` MIME types not being preferred over `image/svg+xml` when rendering Jupyter notebooks to PDF, which caused errors when `rsvg-convert` was not available. (author: @jkrumbiegel)
- ([#14374](https://github.com/quarto-dev/quarto-cli/pull/14374)): Avoid a crash when a third-party Jupyter kernel (observed with Maple 2025, built on XEUS) returns `execute_reply` without the required `status` field. The failing cell is recorded as an error instead of aborting the render. (author: @ChrisJefferson)

## Other fixes and improvements

- ([#6651](https://github.com/quarto-dev/quarto-cli/issues/6651)): Fix dart-sass compilation failing in enterprise environments where `.bat` files are blocked by group policy.
- ([#14255](https://github.com/quarto-dev/quarto-cli/issues/14255)): Fix shortcodes inside inline and display math expressions not being resolved.
- ([#14342](https://github.com/quarto-dev/quarto-cli/issues/14342)): Work around TOCTOU race in Deno's `expandGlobSync` that can cause unexpected exceptions to be raised while traversing directories during project initialization.
- ([#14445](https://github.com/quarto-dev/quarto-cli/issues/14445)): Fix intermittent `Uncaught (in promise) TypeError: Writable stream is closed or errored.` aborting renders on Linux. `execProcess` now awaits and swallows the rejection from `process.stdin.close()` when the child closes its stdin first. The captured stderr is now also surfaced when `typst-gather analyze` falls back to staging all packages, so failures are diagnosable without bypassing `quarto`.
- ([#14359](https://github.com/quarto-dev/quarto-cli/issues/14359)): Fix intermediate `.quarto_ipynb` file not being deleted after rendering a `.qmd` with Jupyter engine, causing numbered variants (`_1`, `_2`, ...) to accumulate on disk across renders.
- ([#14461](https://github.com/quarto-dev/quarto-cli/issues/14461)): Fix `quarto render --to pdf` aborting with `ERROR: Problem running 'fmtutil-sys --all' to rebuild format tree.` when an automatically-installed LaTeX package's post-update format rebuild fails. Format-tree rebuild is now treated as best-effort housekeeping (matching upstream `tinytex` R behavior) — the failure is logged as a warning and the package install completes.
- ([#14472](https://github.com/quarto-dev/quarto-cli/issues/14472)): Add support for Kotlin in code annotations and YAML cell options. (author: @barendgehrels)
- ([#14529](https://github.com/quarto-dev/quarto-cli/issues/14529)): Fix bundled Julia engine path leaking into rendered YAML metadata and pandoc log output when running an installed Quarto. The internal subtree-engine filter only matched the source-tree share-path layout (`resources/extension-subtrees/`) and missed installed layouts where the path is `share/extension-subtrees/`.
- ([#14582](https://github.com/quarto-dev/quarto-cli/issues/14582)): Fix format detection for extension formats (e.g. `acm-pdf`) in project preview, manuscript notebooks, MECA bundles, and website format ordering.
- ([#14595](https://github.com/quarto-dev/quarto-cli/issues/14595)): Fix reload preview in code-server environment
