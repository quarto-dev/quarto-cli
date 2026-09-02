All changes included in 1.11:

## Regression fixes

- ([#14741](https://github.com/quarto-dev/quarto-cli/issues/14741)): Don't wrap the `longtable` environment of a cross-referenceable table in a `{ ... }` group. Pandoc emits that group to scope its `\def\LTcaptype{none}`, which Quarto removes when adding its own `\caption`; keeping the now-pointless group broke packages that move the environment out of the text flow, such as `endfloat` with `\DeclareDelayedFloatFlavor*{longtable}{table}`.

## Accessibility

- ([#13463](https://github.com/quarto-dev/quarto-cli/issues/13463)): The dark/light mode toggle is now a switch (`button` with `role="switch"`, `aria-checked`, and a localized `aria-label`) instead of a nameless link, in all three places it is created: website navbars/sidebars, plain documents with a light/dark theme pair, and multi-page dashboards. Screen readers now announce the control's name, role, and which mode is active, and Space activates it as well as Enter. Custom CSS targeting `a.quarto-color-scheme-toggle` should now target the `button` element instead.
- ([#14615](https://github.com/quarto-dev/quarto-cli/issues/14615)): Fix invalid `role="menu"` on the website navbar's collapse toggle button, flagged by axe-core (`aria-allowed-role`) and WAVE (`aria_menu_broken`) when the navbar collapses to the hamburger at narrow viewports.
- ([#12116](https://github.com/quarto-dev/quarto-cli/issues/12116), [#4935](https://github.com/quarto-dev/quarto-cli/issues/4935)): Website sidebar section toggles are now `<button>` elements, so the keyboard can reach them and `Enter` or `Space` can operate them. Each toggle carries `aria-expanded`, and `aria-labelledby` names each disclosed list after its own section. The toggles no longer carry `role="navigation"`, which removed a spurious navigation landmark from every section.
- ([#14774](https://github.com/quarto-dev/quarto-cli/issues/14774)): Fix missing keyboard focus indicator on the code tools button and on a website's sidebar toggle and sidebar search buttons.

## Formats

### `dashboard`

- ([#14818](https://github.com/quarto-dev/quarto-cli/issues/14818)): Fix a dashboard with more than one page going blank when the URL hash does not name a page, such as a footnote link or a cross-reference. Such a hash is now left alone, so the current page stays visible.
- ([#14819](https://github.com/quarto-dev/quarto-cli/issues/14819)): Fix keyboard focus starting inside the page content when a dashboard opens at a page hash, such as `dashboard.html#sales`. Tabbing forward could not reach the navbar. Focus now starts at the top of the document.

### `html`

- ([#14684](https://github.com/quarto-dev/quarto-cli/issues/14684)): Add a "Skip to main content" link to Bootstrap-themed HTML output (documents, websites, books, dashboards) so keyboard users can bypass navigation blocks (WCAG 2.4.1). The link is the first tab stop on every page, visually hidden until focused, and its text is customizable via the `language` key `skip-to-content`. Dashboards additionally mark their content container as the `main` landmark.

## Engines

### `knitr`

- ([#14735](https://github.com/quarto-dev/quarto-cli/issues/14735)): Fix `cache-globals` rejecting arrays and booleans, so it now accepts the same forms as `cache-vars` and as knitr itself. Previously only a single string validated, which rejected both `cache-globals: [var_1, var_2]` and the documented `cache-globals: false`.

## Other fixes and improvements

- ([#14775](https://github.com/quarto-dev/quarto-cli/issues/14775)): Fix a crash when the `QUARTO_R` environment variable is set to a malformed path. Quarto now warns and falls back to other R lookup strategies instead of aborting the render. ([posit-dev/positron#15614](https://github.com/posit-dev/positron/discussions/15614))
