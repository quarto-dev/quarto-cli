---
main_commit: 50db5a5b0
analyzed_date: 2026-01-22
key_files:
  - src/resources/formats/html/bootstrap/_bootstrap-rules.scss
  - src/resources/formats/revealjs/quarto.scss
  - src/resources/formats/html/styles-callout.html
  - src/resources/filters/customnodes/callout.lua
---

# HTML Callout Styling Architecture

This document describes the CSS architecture for Quarto callouts across HTML-based output formats.

## Overview

Quarto uses a **three-tier callout styling architecture** depending on the output format:

| Tier | Formats | CSS Location | Features |
|------|---------|--------------|----------|
| Bootstrap HTML | `html` (with themes) | `formats/html/bootstrap/_bootstrap-rules.scss` | Full theming, collapsible, dark mode |
| RevealJS | `revealjs` | `formats/revealjs/quarto.scss` | Presentation-specific scaling, slide-aware |
| Standalone HTML | `epub`, `gfm`, plain html | `formats/html/styles-callout.html` | Inline CSS, no dependencies |

All HTML callouts support three **appearance** values:
- **default**: Full-featured with colored header background
- **simple**: Lightweight with left border only
- **minimal**: Maps to simple with `icon=false`

## Format Detection (Lua Filter)

The Lua filter `src/resources/filters/customnodes/callout.lua` selects the appropriate renderer:

```
Renderer selection order:
1. hasBootstrap() → Bootstrap HTML renderer
2. isEpubOutput() || isRevealJsOutput() → Simpler HTML structure
3. isGfmOutput() → GitHub markdown alerts
4. Default → BlockQuote fallback
```

The `hasBootstrap()` function (in `filters/common/pandoc.lua`) checks the `has-bootstrap` parameter set by TypeScript during format initialization.

## HTML Structure by Format

### Bootstrap HTML

```html
<div class="callout callout-style-default callout-note callout-titled">
  <div class="callout-header d-flex align-content-center">
    <div class="callout-icon-container"><i class='callout-icon'></i></div>
    <div class="callout-title-container flex-fill">Title</div>
  </div>
  <div class="callout-body-container">
    <div class="callout-body">Content</div>
  </div>
</div>
```

### EPUB/RevealJS HTML

```html
<div class="callout callout-note callout-style-default">
  <div class="callout-body">
    <div class="callout-icon-container"><i class='callout-icon'></i></div>
    <div class="callout-title">Title</div>
    <div class="callout-content">Content</div>
  </div>
</div>
```

Note: Bootstrap uses `callout-body-container` wrapper and Bootstrap utility classes (`d-flex`, `flex-fill`). EPUB/RevealJS uses a flatter structure.

## Feature Comparison

| Feature | Bootstrap | RevealJS | Standalone |
|---------|-----------|----------|------------|
| Collapsible | Yes | No | No |
| Icon type | SVG (dynamic color) | SVG (dynamic color) | PNG (base64) |
| Theming | Full Bootstrap vars | Presentation vars | Fixed colors |
| Dark mode | Yes | Slide background aware | No |
| Font scaling | Responsive | Presentation-specific (0.7em) | Fixed (0.9rem) |

---

## Bootstrap HTML Styling

File: `src/resources/formats/html/bootstrap/_bootstrap-rules.scss`

### Callout States

| State | CSS Class | Description |
|-------|-----------|-------------|
| Titled | `.callout-titled` | Has a title/header |
| Untitled | `:not(.callout-titled)` | Content only, no header |
| Collapsed | `.callout-header.collapsed` | Collapsible, currently closed |
| Empty content | `.callout-empty-content` | No body content |

### Styling Patterns

**Base callout:**
```scss
.callout {
  margin-top: $callout-margin-top;
  margin-bottom: $callout-margin-bottom;
  border-radius: $border-radius;
}
```

**Simple vs Default appearance:**
- `.callout-style-simple`: Left border only, lighter styling
- `.callout-style-default`: Full border, colored header background

**Body margins** vary by appearance (simple/default) and titled state (titled/untitled). The margin rules handle edge cases like collapsed callouts and empty content states.

### Theming Variables

Bootstrap callouts use SCSS variables (in `_bootstrap-variables.scss`):

```scss
$callout-border-width: 0.4rem !default;
$callout-border-scale: 0% !default;
$callout-icon-scale: 10% !default;
$callout-margin-top: 1.25rem !default;
$callout-margin-bottom: 1.25rem !default;
```

Colors are defined per callout type (note, warning, important, tip, caution) using Bootstrap's color functions.

---

## RevealJS Styling

File: `src/resources/formats/revealjs/quarto.scss`

### Presentation-Specific Adjustments

```scss
// Variables
$callout-border-width: 0.3rem;
$callout-margin-top: 1rem;
$callout-margin-bottom: 1rem;

// Font scaling for slide readability
.reveal div.callout {
  font-size: 0.7em;
}
```

### Light/Dark Slide Awareness

RevealJS callouts adjust colors based on slide background using the `shift_to_dark` mixin:

```scss
.has-dark-background div.callout-note {
  // Lighter colors for dark backgrounds
}
```

---

## Standalone/EPUB Styling

File: `src/resources/formats/html/styles-callout.html`

### Characteristics

- **Inline CSS** embedded in HTML template
- **PNG icons** (base64-encoded) instead of SVG
- **Fixed colors**: Uses hardcoded `#acacac`, `silver` borders
- **No collapsible support**
- **No theming** - works without Bootstrap or any CSS framework

### Key Selectors

```css
.callout                          /* Base container */
.callout.callout-style-simple     /* Simple bordered style */
.callout.callout-style-default    /* Default style with header */
.callout-title                    /* Title container */
.callout-body                     /* Content container */
.callout-icon::before             /* Icon pseudo-element */
```

---

## CSS Class Reference

Classes applied across all HTML formats:

| Class | Applied When | Purpose |
|-------|--------------|---------|
| `.callout` | Always | Base container |
| `.callout-{type}` | Always | Type: note, warning, important, tip, caution |
| `.callout-style-{appearance}` | Always | Style: default, simple |
| `.callout-titled` | Has title | Structural indicator |
| `.no-icon` | `icon=false` | Suppress icon |
| `.callout-empty-content` | No body | Empty state (Bootstrap only) |

---

## Related Files

### CSS/SCSS

| File | Purpose |
|------|---------|
| `src/resources/formats/html/bootstrap/_bootstrap-rules.scss` | Bootstrap HTML callout styles |
| `src/resources/formats/html/bootstrap/_bootstrap-variables.scss` | Bootstrap callout variables |
| `src/resources/formats/revealjs/quarto.scss` | RevealJS callout styles |
| `src/resources/formats/html/styles-callout.html` | Standalone HTML template |
| `src/resources/formats/dashboard/quarto-dashboard.scss` | Dashboard margin overrides |

### Lua Filters

| File | Purpose |
|------|---------|
| `src/resources/filters/customnodes/callout.lua` | Renderer selection and AST processing |
| `src/resources/filters/modules/callouts.lua` | Bootstrap renderer implementation |
| `src/resources/filters/common/pandoc.lua` | `hasBootstrap()` function |

### Tests

| File | Purpose |
|------|---------|
| `tests/docs/callouts.qmd` | All callout types and appearances |
| `tests/docs/playwright/html/callouts/` | Playwright test documents |
| `tests/integration/playwright/tests/html-callouts.spec.ts` | Playwright CSS tests |
