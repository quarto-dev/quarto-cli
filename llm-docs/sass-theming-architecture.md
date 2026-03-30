---
main_commit: ee0f68be1
analyzed_date: 2026-02-26
key_files:
  - src/core/sass.ts
  - src/format/html/format-html-scss.ts
  - src/format/reveal/format-reveal-theme.ts
  - src/format/dashboard/format-dashboard-shared.ts
  - src/command/render/pandoc-html.ts
  - src/resources/formats/revealjs/reveal/css/theme/template/exposer.scss
---

# Sass Theming Architecture

How Quarto compiles Sass for HTML-based formats and the architectural constraints that affect cross-format styling.

## Sass Bundle Structure

Each `SassBundle` has five layer types compiled in specific order:

1. **uses** — `@use` directives for Sass modules
2. **functions** — Sass functions
3. **defaults** — Variables with `!default` flag
4. **mixins** — Reusable Sass mixins
5. **rules** — CSS rules and selectors

Bundles are grouped by `dependency` field and compiled together.

## Compilation Order

**Source:** `src/core/sass.ts`, `compileSass()`

```
Uses:      framework → quarto → user
Functions: framework → quarto → user
Defaults:  user → quarto (REVERSED) → framework (REVERSED)
Mixins:    framework → quarto → user
Rules:     framework → quarto → user
```

Defaults are reversed because Sass `!default` means "set only if not already defined" — first definition wins. User defaults come first so they take priority.

## Bootstrap Pipeline (HTML, Dashboard)

**Key file:** `src/format/html/format-html-scss.ts`, `layerQuartoScss()`

All sass-bundles with `dependency: "bootstrap"` compile in a single Sass invocation together with:
- Bootstrap framework layer (variables, functions, mixins, rules)
- Quarto's `_bootstrap-variables.scss` defaults
- User theme customizations
- YAML metadata variables (via `pandocVariablesToThemeDefaults()`)

Because everything compiles together, theme variables like `$body-bg` and `$body-color` are in scope for all sass-bundle rules.

### Key variables available

| Variable | Default | Purpose |
|----------|---------|---------|
| `$body-bg` | `#fff` | Page background |
| `$body-color` | `#212529` | Main text color |
| `$link-color` | varies | Link color |
| `$border-color` | varies | Border color |
| `$card-bg` | varies | Card background (Dashboard) |

Dark mode: Variables adjust automatically via Bootstrap's dark mode system.

Dashboard uses Bootstrap theming — extends `htmlFormat()` in `format-dashboard.ts` and sets `dependency: "bootstrap"` in `format-dashboard-shared.ts`.

### YAML metadata mapping

**Source:** `pandocVariablesToThemeDefaults()` in `format-html-scss.ts`

| YAML key | Sass variable |
|----------|---------------|
| `backgroundcolor` | `$body-bg` |
| `fontcolor` | `$body-color` |
| `linkcolor` | `$link-color` |
| `mainfont` | `$font-family-base` |
| `monofont` | `$font-family-code` |

## RevealJS Pipeline (Two-Pass Compilation)

RevealJS theme and sass-bundles compile in **separate invocations** of the Sass compiler.

### Why two passes?

RevealJS theme compilation happens during format resolution (`format-reveal-theme.ts`), before Pandoc rendering starts. Sass-bundles come from `formatExtras()` during Pandoc rendering, after the theme is already compiled. This ordering means bundles can't compile with the theme — the theme context no longer exists when bundles are processed.

The solution: `exposer.scss` bridges the gap by exporting theme values as CSS custom properties at runtime.

### Pass 1 — Theme compilation

**Key file:** `src/format/reveal/format-reveal-theme.ts`, `revealTheme()`

- Compiles the chosen theme (built-in or custom `.scss`) with user customizations
- All theme variables (`$body-bg`, `$backgroundColor`, etc.) are in scope
- `exposer.scss` runs, setting CSS custom properties on `:root`
- Output: `quarto-{hash}.css` theme file

### Pass 2 — Sass-bundle compilation

**Key file:** `src/command/render/pandoc-html.ts`

- Processes sass-bundles with `dependency: "reveal-theme"`
- **Completely separate Sass context** — theme variables from Pass 1 are NOT in scope
- Bundles have their own variables (uses, functions, defaults, mixins, rules) but nothing from the theme compilation
- Any `!default` values in the bundle's defaults are the actual values used, regardless of what the theme set

### Bridging the gap: CSS custom properties

RevealJS themes expose variables at runtime via `exposer.scss`:

**Source:** `src/resources/formats/revealjs/reveal/css/theme/template/exposer.scss`

| CSS Custom Property | Sass Source | Type |
|---------------------|-------------|------|
| `--r-background-color` | `$backgroundColor` | Color |
| `--r-main-color` | `$mainColor` | Color |
| `--r-heading-color` | `$headingColor` | Color |
| `--r-link-color` | `$linkColor` | Color |
| `--r-link-color-dark` | `darken($linkColor, 15%)` | Color |
| `--r-overlay-element-bg-color` | `$overlayElementBgColor` | Raw RGB (e.g., `240, 240, 240`) |
| `--r-overlay-element-fg-color` | `$overlayElementFgColor` | Raw RGB |

Note: Overlay element variables store raw RGB values, not hex. Use as: `rgba(var(--r-overlay-element-bg-color), 0.95)`.

### RevealJS theme variables

**Source:** `src/resources/formats/revealjs/quarto.scss`

```scss
$body-bg: #fff !default;
$body-color: #222 !default;
$backgroundColor: $body-bg !default;
$mainColor: $body-color !default;
```

Dark themes (e.g., `themes/dark.scss`) override these:
```scss
$body-bg: #191919 !default;
$body-color: #fff !default;
```

## Cross-Format CSS Pattern

For sass-bundles that must produce correct CSS across both Bootstrap and RevealJS:

```scss
background-color: var(--r-background-color, $body-bg);
color: var(--r-main-color, $body-color);
```

- **RevealJS:** `--r-background-color` exists (set by exposer.scss at runtime) → uses theme value
- **Bootstrap:** `--r-background-color` doesn't exist → CSS fallback → uses `$body-bg` (compiled from theme)

Both formats get the correct theme color, but via different mechanisms: runtime CSS custom property (RevealJS) vs compile-time Sass variable (Bootstrap).

## Debugging

### Save compiled SCSS

```bash
export QUARTO_SAVE_SCSS=/tmp/debug
quarto render document.qmd
# Inspect /tmp/debug-1.scss for layer boundaries
```

The saved file includes `// quarto-scss-analysis-annotation` comments showing which layer contributed each section.

### Verify final variable values

Add to theme or sass-bundle rules:

```scss
:root {
  --debug-body-bg: #{$body-bg};
  --debug-body-color: #{$body-color};
}
```

Inspect computed CSS custom properties in browser DevTools.

## Variable Resolution Example

Given: RevealJS document with `theme: dark` and an axe sass-bundle defining `$body-bg: #fff !default`

**Pass 1 (theme):**
- `dark.scss`: `$body-bg: #191919 !default` → `$backgroundColor: #191919`
- `exposer.scss`: `--r-background-color: #191919` on `:root`

**Pass 2 (axe bundle — separate Sass invocation):**
- Bundle defaults: `$body-bg: #fff !default` → resolves to `#fff` (theme value is NOT in scope)
- Bundle rules: `background-color: var(--r-background-color, #fff)`
- CSS output: `background-color: var(--r-background-color, #fff)`

**Browser runtime:**
- `--r-background-color` is `#191919` (from theme CSS in Pass 1) → report gets dark background
- The `#fff` Sass fallback is never used because the CSS custom property takes precedence

## Key Source Files

| File | Role |
|------|------|
| `src/core/sass.ts` | Sass compilation pipeline, `compileSass()` |
| `src/format/html/format-html-scss.ts` | Bootstrap layer composition, `layerQuartoScss()` |
| `src/format/reveal/format-reveal-theme.ts` | RevealJS theme compilation, `revealTheme()` |
| `src/format/dashboard/format-dashboard-shared.ts` | Dashboard sass layer (Bootstrap dependency) |
| `src/command/render/pandoc-html.ts` | Sass-bundle grouping and compilation |
| `src/resources/formats/revealjs/quarto.scss` | RevealJS Sass defaults and mappings |
| `src/resources/formats/revealjs/reveal/css/theme/template/exposer.scss` | CSS custom property exposure |
| `src/resources/formats/html/bootstrap/_bootstrap-variables.scss` | Quarto Bootstrap variable defaults |
