All changes included in 1.11:

## Regression fixes

- ([#14741](https://github.com/quarto-dev/quarto-cli/issues/14741)): Don't wrap the `longtable` environment of a cross-referenceable table in a `{ ... }` group. Pandoc emits that group to scope its `\longtablewidth`.

## Accessibility

- ([#13463](https://github.com/quarto-dev/quarto-cli/issues/13463)): The dark/light mode toggle is now a switch (`button` with `role="switch"`, `aria-checked`, and a localized `aria-label`) instead of a link.
- ([#14615](https://github.com/quarto-dev/quarto-cli/issues/14615)): Fix invalid `role="menu"` on the website navbar's collapse toggle button, flagged by axe-core (`aria-allowed-role`) and WAVE (`aria-role-mismatch`).
- ([#12116](https://github.com/quarto-dev/quarto-cli/issues/12116), [#4935](https://github.com/quarto-dev/quarto-cli/issues/4935)): Website sidebar section toggles are now `<button>` elements, so they are keyboard accessible and properly announced.
- ([#14774](https://github.com/quarto-dev/quarto-cli/issues/14774)): Fix missing keyboard focus indicator on the code tools button and on a website's sidebar toggle and sidebar search buttons.
- ([#14815](https://github.com/quarto-dev/quarto-cli/pull/14815)): Add `quarto call axe`, a hidden experimental command that scans a rendered site for accessibility violations with axe-core across a page × viewport × color-mode matrix, groups them by root-cause signature, reconciles a committed baseline, and can gate CI with `--fail-on`. See [dev-docs/axe-scan.md](https://github.com/quarto-dev/quarto-cli/blob/main/dev-docs/axe-scan.md).

## Formats

### `dashboard`

- ([#14818](https://github.com/quarto-dev/quarto-cli/issues/14818)): Fix a dashboard with more than one page going blank when the URL hash does not name a page, such as a footnote link or a cross-reference link.
- ([#14819](https://github.com/quarto-dev/quarto-cli/issues/14819)): Fix keyboard focus starting inside the page content when a dashboard opens at a page hash, such as `dashboard.html#sales`. Tabbing backward now correctly returns to the page navigation tabs.

### `html`

- ([#14684](https://github.com/quarto-dev/quarto-cli/issues/14684)): Add a "Skip to main content" link to Bootstrap-themed HTML output (documents, websites, books, dashboards) so keyboard users can bypass the navbar and sidebars.

### `typst`

- ([#14847](https://github.com/quarto-dev/quarto-cli/pull/14847)): Fix `toc_title` auto-fallback in typst outline template that was ignoring the computed fallback value when `toc_title` is `none`.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously they were ignored.

### `julia`

- ([#14834](https://github.com/quarto-dev/quarto-cli/issues/14834)): Fix `ERROR: Internal Error` when rendering documents whose payload exceeds the Julia server's socket send buffer.
- ([PumasAI/quarto-julia-engine#8](https://github.com/PumasAI/quarto-julia-engine/pull/8)): Support `keep-ipynb`, which writes the executed notebook to `<stem>.ipynb` alongside the source file.
- ([PumasAI/quarto-julia-engine#13](https://github.com/PumasAI/quarto-julia-engine/pull/13)): Shell (`;`), help (`?`), and Pkg (`]`) mode cells now work when the cell has `#|` options.
- ([PumasAI/quarto-julia-engine#11](https://github.com/PumasAI/quarto-julia-engine/pull/11)): Support `fig-format: retina`, normalized to `png` with doubled `fig-dpi` as in the `jupyter` and `knitr` engines.
- ([PumasAI/quarto-julia-engine#7](https://github.com/PumasAI/quarto-julia-engine/pull/7)): Support `execute-dir`, shared worker processes across notebooks with matching configs (`share_worker_process: true`).

## Other fixes and improvements

- ([#14775](https://github.com/quarto-dev/quarto-cli/issues/14775)): Fix a crash when the `QUARTO_R` environment variable is set to a malformed path. Quarto now warns and falls back to other R lookup methods.
