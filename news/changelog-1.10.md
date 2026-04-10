All changes included in 1.10:

## Regression fixes

- ([#14267](https://github.com/quarto-dev/quarto-cli/issues/14267)): Fix Windows paths with accented characters (e.g., `C:\Users\Sébastien\`) breaking dart-sass compilation.
- ([#14281](https://github.com/quarto-dev/quarto-cli/issues/14281)): Fix transient `.quarto_ipynb` files accumulating during `quarto preview` with Jupyter engine.
- ([#14298](https://github.com/quarto-dev/quarto-cli/issues/14298)): Fix `quarto preview` browse URL including output filename (e.g., `hello.html`) for single-file documents, breaking Posit Workbench proxied server access.
- ([rstudio/rstudio#17333](https://github.com/rstudio/rstudio/issues/17333)): Fix `quarto inspect` on standalone files emitting project metadata that breaks RStudio's publishing wizard.

## Engines

### `julia`

- Update `julia` engine extension from 0.1.0 to 0.2.0 and QuartoNotebookRunner from 0.17.4 to 0.18.1.
- Add `keep-ipynb` support. When `keep-ipynb: true` is set in document YAML, the executed notebook is written alongside the source file.
- Add shared worker processes. Multiple notebooks sharing the same config can reuse a single worker process via `julia: share_worker_process: true`.
- Add support for `execute-dir: project` to set working directory to project root.
- Add diagnostic file logging via `QUARTONOTEBOOKRUNNER_LOG` environment variable.
- Cache worker package environments across sessions, skipping environment setup on subsequent runs when Julia and QNR versions haven't changed.
- Relax manifest version checking to major.minor by default, matching Julia's Pkg behavior. Opt into strict checking via `julia: strict_manifest_versions: true`.
- Fix `fig-format: retina` by normalizing to `png` with doubled `fig-dpi`, matching Jupyter and knitr backends.
- Fix cache invalidation to hash full `Manifest.toml` content so dependency version changes correctly invalidate the cache.
- Fix duplicate YAML keys when Python/R cells have cell options like `echo`.
## Formats

### `typst`

- ([#14261](https://github.com/quarto-dev/quarto-cli/issues/14261)): Fix theorem/example block titles containing inline code producing invalid Typst markup when syntax highlighting is applied.

## Commands

### `quarto preview`

- ([#14281](https://github.com/quarto-dev/quarto-cli/issues/14281)): Avoid creating a duplicate `.quarto_ipynb` file on preview startup for single-file Jupyter documents.

### `install`

- ([#11877](https://github.com/quarto-dev/quarto-cli/issues/11877), [#9710](https://github.com/quarto-dev/quarto-cli/issues/9710)): Add arm64 Linux support for `quarto install chrome-headless-shell` using Playwright CDN as download source, since Chrome for Testing has no arm64 Linux builds.
- ([#11877](https://github.com/quarto-dev/quarto-cli/issues/11877)): Deprecate `quarto install chromium` — the command now transparently redirects to `chrome-headless-shell`. Installing `chrome-headless-shell` automatically removes any legacy Chromium installation. Use `chrome-headless-shell` instead, which always installs the latest stable Chrome (the legacy `chromium` installer pins an outdated Puppeteer revision that cannot receive security updates).

### `check`

- ([#11877](https://github.com/quarto-dev/quarto-cli/issues/11877)): `quarto check install` now shows a deprecation warning when legacy Chromium (installed via `quarto install chromium`) is detected, directing users to install `chrome-headless-shell` as a replacement.

### `quarto create`

- ([#14250](https://github.com/quarto-dev/quarto-cli/issues/14250)): Fix `quarto create` producing read-only files when Quarto is installed via system packages (e.g., `.deb`). Files copied from installed resources now have user-write permission ensured.

## Lua API

- ([#14297](https://github.com/quarto-dev/quarto-cli/pull/14297)): Fix `quarto.utils.is_empty_node()` returning inverted results for text nodes (`Str`, `Code`, `RawInline`).

## Other fixes and improvements

- ([#6651](https://github.com/quarto-dev/quarto-cli/issues/6651)): Fix dart-sass compilation failing in enterprise environments where `.bat` files are blocked by group policy.
- ([#14255](https://github.com/quarto-dev/quarto-cli/issues/14255)): Fix shortcodes inside inline and display math expressions not being resolved.
- ([#14342](https://github.com/quarto-dev/quarto-cli/issues/14342)): Work around TOCTOU race in Deno's `expandGlobSync` that can cause unexpected exceptions to be raised while traversing directories during project initialization.