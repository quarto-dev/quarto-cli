All changes included in 1.10:

## Regression fixes

- ([#14267](https://github.com/quarto-dev/quarto-cli/issues/14267)): Fix Windows paths with accented characters (e.g., `C:\Users\Sébastien\`) breaking dart-sass compilation.
- ([#14281](https://github.com/quarto-dev/quarto-cli/issues/14281)): Fix transient `.quarto_ipynb` files accumulating during `quarto preview` with Jupyter engine.
- ([#14298](https://github.com/quarto-dev/quarto-cli/issues/14298)): Fix `quarto preview` browse URL including output filename (e.g., `hello.html`) for single-file documents, breaking Posit Workbench proxied server access.
- ([rstudio/rstudio#17333](https://github.com/rstudio/rstudio/issues/17333)): Fix `quarto inspect` on standalone files emitting project metadata that breaks RStudio's publishing wizard.

## Formats

### `pdf`

- ([#13588](https://github.com/quarto-dev/quarto-cli/issues/13588)): Fix Lua error when rendering PDF with `reference-location: margin` and a footnote alongside a figure with `fig-cap`. (author: @mcanouil)

### `typst`

- ([#14261](https://github.com/quarto-dev/quarto-cli/issues/14261)): Fix theorem/example block titles containing inline code producing invalid Typst markup when syntax highlighting is applied.
- ([#14460](https://github.com/quarto-dev/quarto-cli/issues/14460)): Fix CSS `border` and `border-color` declarations losing tokens that precede an `rgb()`/`rgba()` color (e.g. `border: 0px solid rgb(255, 0, 0)` rendering as a 2.25pt border instead of being suppressed).

### `revealjs`

- ([#14354](https://github.com/quarto-dev/quarto-cli/pull/14354)): Fix trailing whitespace after author name on title slide when ORCID is not set. (author: @jnkatz)

## Projects

### Websites

- ([#13565](https://github.com/quarto-dev/quarto-cli/issues/13565), [#14353](https://github.com/quarto-dev/quarto-cli/issues/14353)): Fix sidebar logo not appearing on secondary sidebars in multi-sidebar website layouts.

## Commands

### `quarto preview`

- ([#14281](https://github.com/quarto-dev/quarto-cli/issues/14281)): Avoid creating a duplicate `.quarto_ipynb` file on preview startup for single-file Jupyter documents.

### `install`

- ([#14304](https://github.com/quarto-dev/quarto-cli/issues/14304)): Fix `quarto install tinytex` silently ignoring extraction failures. When archive extraction fails (e.g., `.tar.xz` on a system without `xz-utils`), the installer now reports a clear error instead of proceeding and failing with a confusing `NotFound` message.
- ([#11877](https://github.com/quarto-dev/quarto-cli/issues/11877), [#9710](https://github.com/quarto-dev/quarto-cli/issues/9710)): Add arm64 Linux support for `quarto install chrome-headless-shell` using Playwright CDN as download source, since Chrome for Testing has no arm64 Linux builds.
- ([#11877](https://github.com/quarto-dev/quarto-cli/issues/11877)): Deprecate `quarto install chromium` — the command now transparently redirects to `chrome-headless-shell`. Installing `chrome-headless-shell` automatically removes any legacy Chromium installation. Use `chrome-headless-shell` instead, which always installs the latest stable Chrome (the legacy `chromium` installer pins an outdated Puppeteer revision that cannot receive security updates).
- ([#14363](https://github.com/quarto-dev/quarto-cli/pull/14363)): Add retry logic for tool downloads to handle transient network failures (connection resets, CDN timeouts) during `quarto install`.

### `check`

- ([#11877](https://github.com/quarto-dev/quarto-cli/issues/11877)): `quarto check install` now shows a deprecation warning when legacy Chromium (installed via `quarto install chromium`) is detected, directing users to install `chrome-headless-shell` as a replacement.

### `quarto create`

- ([#14250](https://github.com/quarto-dev/quarto-cli/issues/14250)): Fix `quarto create` producing read-only files when Quarto is installed via system packages (e.g., `.deb`). Files copied from installed resources now have user-write permission ensured.

## Lua API

- ([#14297](https://github.com/quarto-dev/quarto-cli/pull/14297)): Fix `quarto.utils.is_empty_node()` returning inverted results for text nodes (`Str`, `Code`, `RawInline`).

## Engines

### Jupyter

- ([#14374](https://github.com/quarto-dev/quarto-cli/pull/14374)): Avoid a crash when a third-party Jupyter kernel (observed with Maple 2025, built on XEUS) returns `execute_reply` without the required `status` field. The failing cell is recorded as an error instead of aborting the render. (author: @ChrisJefferson)

## Other fixes and improvements

- ([#6651](https://github.com/quarto-dev/quarto-cli/issues/6651)): Fix dart-sass compilation failing in enterprise environments where `.bat` files are blocked by group policy.
- ([#14255](https://github.com/quarto-dev/quarto-cli/issues/14255)): Fix shortcodes inside inline and display math expressions not being resolved.
- ([#14342](https://github.com/quarto-dev/quarto-cli/issues/14342)): Work around TOCTOU race in Deno's `expandGlobSync` that can cause unexpected exceptions to be raised while traversing directories during project initialization.
- ([#14445](https://github.com/quarto-dev/quarto-cli/issues/14445)): Fix intermittent `Uncaught (in promise) TypeError: Writable stream is closed or errored.` aborting renders on Linux. `execProcess` now awaits and swallows the rejection from `process.stdin.close()` when the child closes its stdin first. The captured stderr is now also surfaced when `typst-gather analyze` falls back to staging all packages, so failures are diagnosable without bypassing `quarto`.
- ([#14359](https://github.com/quarto-dev/quarto-cli/issues/14359)): Fix intermediate `.quarto_ipynb` file not being deleted after rendering a `.qmd` with Jupyter engine, causing numbered variants (`_1`, `_2`, ...) to accumulate on disk across renders.