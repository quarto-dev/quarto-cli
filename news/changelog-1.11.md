All changes included in 1.11:

## Regression fixes

- ([#14731](https://github.com/quarto-dev/quarto-cli/pull/14731)): Fix `QUARTO_VENDOR_BINARIES=false` builds silently succeeding with missing binaries. The `configure` step's "is it on PATH?" check for `typst-gather`, `typst`, `pandoc` and `esbuild` compared an unawaited `Promise` against `undefined`, so the guard never fired. A build with `typst-gather` neither vendored nor on PATH reported success and produced a Quarto tree without it, surfacing only at render time as `typst-gather analyze failed; staging all packages as fallback`. The missing-binary error message now also names the path that was checked and the `QUARTO_TYPST_GATHER` environment variable.
- ([#14741](https://github.com/quarto-dev/quarto-cli/issues/14741)): Don't wrap the `longtable` environment of a cross-referenceable table in a `{ ... }` group. Pandoc emits that group to scope its `\longtablewidth`.
- ([#14857](https://github.com/quarto-dev/quarto-cli/issues/14857)): Fix `quarto install chrome-headless-shell` (and `quarto install chromium`) failing with a 404 on Linux arm64 due to a stale Playwright CDN URL.

## Accessibility

- ([#13463](https://github.com/quarto-dev/quarto-cli/issues/13463)): The dark/light mode toggle is now a switch (`button` with `role="switch"`, `aria-checked`, and a localized `aria-label`) instead of a link.
- ([#14615](https://github.com/quarto-dev/quarto-cli/issues/14615)): Fix invalid `role="menu"` on the website navbar's collapse toggle button, flagged by axe-core (`aria-allowed-role`) and WAVE (`aria-role-mismatch`).
- ([#12116](https://github.com/quarto-dev/quarto-cli/issues/12116), [#4935](https://github.com/quarto-dev/quarto-cli/issues/4935)): Website sidebar section toggles are now `<button>` elements, so they are keyboard accessible and properly announced.
- ([#14774](https://github.com/quarto-dev/quarto-cli/issues/14774)): Fix missing keyboard focus indicator on the code tools button and on a website's sidebar toggle and sidebar search buttons.
- ([#14376](https://github.com/quarto-dev/quarto-cli/issues/14376)): Add a distinct, localizable `aria-label` to each navigation landmark of websites and books: the navbar (`Site`), the sidebar (`Section`, or `Site` when there is no navbar), the narrow-viewport toolbar (`Toolbar`), the previous/next page navigation (`Page`), and the breadcrumbs (`Breadcrumbs`) (previously hardcoded English `breadcrumb`). The new `navigation-*-label` language keys can be overridden with `language:` metadata.
- ([#14376](https://github.com/quarto-dev/quarto-cli/issues/14376)): Translate the new `navigation-*-label` keys in all 33 built-in language files. The values are drawn from existing human-translated interface strings (LibreOffice, GNOME, Wikidata) and each one carries a comment naming its source; values that were adapted rather than used verbatim are marked `needs review`.
- ([#14376](https://github.com/quarto-dev/quarto-cli/issues/14376)): Label the table of contents `<nav>` with its localized title (`aria-labelledby`), in `html` and `revealjs` output, so assistive technology can tell it apart from other navigation landmarks.

## Formats

### All Formats

- ([#14772](https://github.com/quarto-dev/quarto-cli/issues/14772)): Custom `language` keys now reach templates through `$quarto.language.<key>$`. A key that Quarto does not ship passed schema validation and was merged over the defaults, then discarded before templates saw it, so it expanded to an empty string with no warning. (author: @mcanouil)

### `dashboard`

- ([#14818](https://github.com/quarto-dev/quarto-cli/issues/14818)): Fix a dashboard with more than one page going blank when the URL hash does not name a page, such as a footnote link or a cross-reference link.
- ([#14819](https://github.com/quarto-dev/quarto-cli/issues/14819)): Fix keyboard focus starting inside the page content when a dashboard opens at a page hash, such as `dashboard.html#sales`. Tabbing backward now correctly returns to the page navigation tabs.

### `html`

- ([#14684](https://github.com/quarto-dev/quarto-cli/issues/14684)): Add a "Skip to main content" link to Bootstrap-themed HTML output (documents, websites, books, dashboards) so keyboard users can bypass the navbar and sidebars.

### `typst`

- ([#14847](https://github.com/quarto-dev/quarto-cli/pull/14847)): Fix `toc_title` auto-fallback in typst outline template that was ignoring the computed fallback value when `toc_title` is `none`.

## Commands

### `call`

- ([#14815](https://github.com/quarto-dev/quarto-cli/pull/14815)): Add `quarto call axe`, a hidden experimental command that scans a rendered site for accessibility violations with axe-core across a page × viewport × color-mode matrix, groups them by root-cause signature, reconciles a committed baseline, and can gate CI with `--fail-on`. See [dev-docs/axe-scan.md](https://github.com/quarto-dev/quarto-cli/blob/main/dev-docs/axe-scan.md).

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

## Other fixes and improvements

- ([#14775](https://github.com/quarto-dev/quarto-cli/issues/14775)): Fix a crash when the `QUARTO_R` environment variable is set to a malformed path. Quarto now warns and falls back to other R lookup methods.
- ([#14865](https://github.com/quarto-dev/quarto-cli/issues/14865)): Fix internal links in a preview being treated as external when the preview is reached through a proxy, such as on Posit Workbench. Links are now classified against the origin the browser sees.
