---
main_commit: abc6a78ed
analyzed_date: 2026-08-20
key_files:
  - src/format/html/format-html-info.ts
  - src/format/html/format-html-scss.ts
  - src/format/html/format-html-bootstrap.ts
  - src/command/render/pandoc-html.ts
  - src/resources/formats/html/templates/quarto-html-before-body.ejs
  - src/project/project-shared.ts
  - src/core/brand/brand.ts
---

# HTML Dark Mode Architecture

How an author configures dark/light mode for `format: html` (including websites), and how the rendered page exposes it. Written for tools that must detect and switch modes on rendered pages, such as the axe scanner.

The core model: a page ships **one presentation or two**. When it ships two, the second is the **alternate**, and the alternate is always the dark slot. This is a per-page property, not a per-site property.

## The one predicate

`formatDarkMode(format)` in `src/format/html/format-html-info.ts:33-39` answers "does this page have a dark mode":

- `undefined` — no dark mode. No toggle, no alternate-stylesheet JS, no before-body script.
- `false` — dark mode exists; the default is light.
- `true` — dark mode exists; the default is dark.

It gates the toggle (`src/project/types/website/website-navigation.ts:356-362`), the before-body script (`src/format/html/format-html.ts:351`, template written at `:530`), and the body class (`format-html-bootstrap.ts:1073-1078`). Its inputs: `darkModeDefaultMetadata()` (`format-html-info.ts:46-70`) reads key order of `theme:` then `brand:`; `darkModeDefault()` (`:71-85`) adds a fallback on `format.render.brand?.dark`.

## Configuration surface

### `theme`

Schema: `string | string[] | {light?, dark?}` (`src/resources/schema/document-options.yml:17-35`). Parsed by `resolveThemeLayer()` (`src/format/html/format-html-scss.ts:375-455`):

| YAML | Normalized | Modes |
|---|---|---|
| `theme: cosmo` | `{light: [cosmo]}` | one (light) |
| `theme: darkly` | `{light: [darkly]}` | one — a dark-*colored* single mode; the machinery still calls it the light slot |
| `theme: {light: cosmo, dark: darkly}` | as written | two, default light |
| `theme: {dark: darkly, light: cosmo}` | as written | two, default dark (key order decides: `format-html-scss.ts:410`) |

### `brand`

Two routes, both feeding the same pipeline:

1. **Explicit paths** — `brand: {light: path, dark: path}` at the config root or under `project:` (`src/project/project-shared.ts:599-607`). Dark mode exists iff a `dark:` path is present (`:656`).
2. **Unified `_brand.yml`** — candidate paths `_brand.yml`, `_brand.yaml`, `_brand/_brand.yml`, `_brand/_brand.yaml` (`project-shared.ts:620-629`). Dark is per-value: `color: {background: {light: ..., dark: ...}}`. `brandHasDarkMode()` (`src/core/brand/brand.ts:545-590`) scans colors, typography, and logos for any `dark` key. `splitUnifiedBrand()` (`:773-805`) splits the file into two `Brand` objects.

Document front matter can override per page: `brand: false` removes branding (and its dark mode) for that page; a string or `{light:, dark:}` object replaces it (`project-shared.ts:668-719`).

Brand SASS layers become one more bundle with a `dark` half (`src/core/sass/brand.ts:571-674`). From `src/command/render/pandoc-html.ts:140` on, brand dark and theme dark are indistinguishable — one `hasDark` flag drives all output. A detector does not need to know which route produced the dark mode.

### Precedence between `theme.dark` and brand dark

- **Default mode:** `theme:` key order wins over `brand:` key order (`format-html-info.ts:46-70`). A unified `_brand.yml` carries no preference and defaults to light (`:81-82`).
- **Variable values:** SASS `!default` order. Brand normally sits before the theme, so the theme overrides brand. An explicit `brand` marker in the theme list (`theme: {dark: [cyborg, brand]}`) reverses this (`pandoc-html.ts:91-137`, `format-html-scss.ts:216-219`). Pinned by `tests/integration/playwright/tests/html-dark-mode.spec.ts` and `html-dark-mode-defaultlight.spec.ts`.

### `respect-user-color-scheme`

`kRespectUserColorScheme` (`src/config/constants.ts:156`), default `false`. It changes **only the inline JS**: the initial mode comes from `matchMedia('(prefers-color-scheme: dark)')` instead of the author default, plus a `change` listener that defers to any stored user choice (`quarto-html-before-body.ejs:167-173`, `:192-201`). The markup is byte-identical to the default case. Quarto never emits `media=` attributes on links and never generates `prefers-color-scheme` CSS. Consequence: browser color-scheme emulation alone cannot select a default-config Quarto dark theme.

### Per-page resolution

Format metadata merges project `_quarto.yml` → directory `_metadata.yml` → front matter, last wins, per file (`src/command/render/render-contexts.ts:510-514`). Everything downstream is computed per file. One website legitimately mixes two-mode and one-mode pages. `theme` merges deeply (array union), and the **project's** key order decides the default even when a page adds the `dark:` slot. A detector must decide per page; `_quarto.yml` alone is not sufficient evidence.

## Rendered-page markers

Reference rendering (`theme: {light: cosmo, dark: darkly}` website): `tests/docs/axe-scan/sites/findings`. A two-mode page carries six stylesheet links:

| Href | Class | Extra attributes |
|---|---|---|
| `quarto-syntax-highlighting-*.css` | `quarto-color-scheme` | `id="quarto-text-highlighting-styles"` |
| `quarto-syntax-highlighting-dark-*.css` | `quarto-color-scheme quarto-color-alternate` | same id |
| `quarto-syntax-highlighting-*.css` | `quarto-color-scheme-extra` | same id |
| `bootstrap-*.css` | `quarto-color-scheme` | `id="quarto-bootstrap" data-mode="light"` |
| `bootstrap-dark-*.css` | `quarto-color-scheme quarto-color-alternate` | `id="quarto-bootstrap" data-mode="dark"` |
| `bootstrap-*.css` | `quarto-color-scheme-extra` | `id="quarto-bootstrap" data-mode="light"` |

Notes:

- `rel="stylesheet"` enables a link; the JS disables with `rel="disabled-stylesheet"` (`quarto-html-before-body.ejs:40-71`). Dark is layered on light: in dark mode, the light sheets stay enabled and the alternates are enabled on top.
- The `-extra` duplicates exist only when the author default is light (`pandoc-html.ts:179-195`). They serve the no-JS cascade and are disabled at parse time (`.ejs:176-177`), never re-enabled. They do **not** carry the `quarto-color-scheme` class.
- Duplicate `id` attributes are by design (three links share `id="quarto-bootstrap"`). Expect axe to flag this.
- `data-mode` appears only on bootstrap links, and only measures color (next section).
- **Reliable static marker for "this page has two modes":** the inline `<script id="quarto-html-before-body">` that defines `window.quartoToggleColorScheme` (`.ejs:183`). The navbar/sidebar toggle (`a.quarto-color-scheme-toggle`, from `navdarktoggle.ejs`) is server-rendered when navigation exists, but a floating fallback is injected only at `DOMContentLoaded` (`quarto-html-after-body.ejs:12-25`) — so the toggle *element* is not a reliable static marker.
- **Body class:** every Bootstrap page gets `quarto-light` or `quarto-dark` server-side (`format-html-bootstrap.ts:1073-1078`); the JS keeps it in sync. Presence proves nothing about two-mode support; it identifies the default (or only) mode's *slot*, not its color — a `theme: darkly` page says `quarto-light`.
- **The mode axis changes the DOM, not just the palette.** `body.quarto-light .dark-content { display: none !important }` and its mirror (`src/resources/formats/html/_quarto-rules.scss:767-775`) drive `.light-content`/`.dark-content` blocks, per-mode logos (`navbrand.ejs`, `sidebar.ejs`), and per-mode cell renderings (`quarto-post/cell-renderings.lua:61-62`).

## `data-mode` is a measurement, not a declaration

`data-mode` comes from a sentinel in the compiled CSS, not from the YAML slot. `_bootstrap-rules.scss:1938-1943` emits `/*! dark */` when the compiled `$body-bg` blackness exceeds `$code-block-theme-dark-threshhold` (default 40%). `cssHasDarkModeSentinel()` (`src/core/pandoc/css.ts:45-47`) reads it; `pandoc-html.ts:226` writes the attribute.

So:

- `theme: {light: cosmo, dark: flatly}` — a light-colored theme in the dark slot gives `data-mode="light"` on the *alternate* link. A `[data-mode="dark"]` probe misses this real second presentation.
- `theme: darkly` — the single link gets `data-mode="dark"` but no `quarto-color-scheme` class. This is the only rendered signal that a one-mode page is dark-colored.

The stable identity of the dark **slot** is the `quarto-color-alternate` class, not `data-mode`.

## Switching modes programmatically

All switching logic is inline in the before-body script; `quarto.js` contains none. `localStorage` key: `"quarto-color-scheme"`, values `"alternate"` (dark slot, always) and `"default"` (`.ejs:115-131`). The script applies the stored value during parse (`.ejs:204-208`), and an explicit stored value wins over `respect-user-color-scheme`'s matchMedia (`.ejs:194-195`).

For a driver (CDP, Playwright), in order of preference:

1. Set `localStorage["quarto-color-scheme"]` to `"alternate"` or `"default"` before navigation. Deterministic, no flash, no relayout wait, works in both `respect-user-color-scheme` configurations. On `file:` URLs localStorage is unavailable and the script falls back to an in-page variable (`.ejs:102-104`).
2. Call `window.quartoToggleColorScheme()` or click `a.quarto-color-scheme-toggle`. Both are relative (they flip), so read the state back afterwards.
3. Color-scheme emulation. Only matters for `respect-user-color-scheme: true` pages and hand-written `prefers-color-scheme` CSS.

To read the active mode: the `body` class, or the `rel` of `link.quarto-color-scheme.quarto-color-alternate`.

## Traps

| Situation | Rendered result | Trap |
|---|---|---|
| Light-only `_brand.yml` | Full `quarto-color-scheme`/`quarto-color-alternate` link set, all `data-mode="light"`, **no toggle, no before-body script** | An "alternate link exists" probe reports two modes; there is one. Cause: stylesheets key off `project.resolveBrand()` (always split) while the toggle keys off `format.render.brand.dark` (`render-contexts.ts:574-585`). Fixture: `tests/docs/axe-scan/sites/brand-light-only` |
| `theme: {light: cosmo, dark: flatly}` | Alternate link with `data-mode="light"` | A `[data-mode="dark"]` probe reports one mode; there are two |
| `theme: darkly` | One link, `data-mode="dark"`, no `quarto-color-scheme` class, `body.quarto-light` | Visually dark page that every declaration-level signal calls light |
| `theme: none` / `html+minimal` + brand dark | Untested edge: `brandSassFormatExtras` still contributes a bootstrap bundle (`pandoc-html.ts:284-294`) | Possible alternate stylesheets with no JS to manage them |
| Hand-written `@media (prefers-color-scheme: dark)` in custom SCSS | Passes through untouched; nothing detects it | The one dark presentation invisible to all Quarto markers |

## Key constants and functions

| Name | Location |
|---|---|
| `kTheme` = `"theme"` | `src/config/constants.ts:635` |
| `kBrand` = `"brand"` | `src/config/constants.ts:123` |
| `kRespectUserColorScheme` | `src/config/constants.ts:156` |
| `formatDarkMode`, `darkModeDefault`, `darkModeDefaultMetadata` | `src/format/html/format-html-info.ts:33-85` |
| `brandHasDarkMode`, `splitUnifiedBrand` | `src/core/brand/brand.ts:545-590`, `:773-805` |
| `cssHasDarkModeSentinel` | `src/core/pandoc/css.ts:45-47` |
| `attribForThemeStyle` (link attributes) | `src/command/render/pandoc-html.ts:658-679` |

There is no `kSiteTheme`; `theme` always lives under `format: html:`, never under `website:`.
