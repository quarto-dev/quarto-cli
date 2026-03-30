---
main_commit: ee0f68be1
analyzed_date: 2026-02-27
key_files:
  - src/format/html/format-html.ts
  - src/format/html/format-html-axe.ts
  - src/resources/formats/html/axe/axe-check.js
  - src/resources/formats/html/axe/axe-check.scss
  - src/resources/formats/revealjs/axe/axe-check.scss
  - src/resources/formats/dashboard/axe/axe-check.scss
---

# Axe Accessibility Checking Architecture

Quarto's axe-core integration spans three layers: build-time TypeScript, compile-time SCSS, and runtime JavaScript. Each layer operates at a fundamentally different stage, which is why they detect formats differently.

## Three-Layer Overview

### Layer 1: Build-time TypeScript (format detection + dependency injection)

**File:** `src/format/html/format-html.ts`

TypeScript code detects the output format and conditionally injects `axe-check.js` + `axe-check.css` as a `FormatDependency`. The format detection uses the Quarto format system (`isHtmlOutput`, `isRevealJsOutput`, `isDashboardOutput`).

Key responsibilities:
- Read `axe` option from document metadata
- Inject axe files as `FormatDependency` (copies JS/CSS into output)
- Encode options as base64 JSON into a `<script>` tag

The base64 encoding is a defensive pattern that prevents JSON containing `</script>` from breaking the HTML parser.

### Layer 2: Compile-time SCSS (format-specific styling)

**Files:**
- `src/resources/formats/html/axe/axe-check.scss` — HTML/dashboard styles
- `src/resources/formats/revealjs/axe/axe-check.scss` — RevealJS-specific styles

SCSS files provide format-specific visual styling. RevealJS compiles its sass-bundles separately from the theme, so theme variables aren't in scope. The CSS custom property bridge (`--quarto-axe-*` variables set in HTML themes, consumed in RevealJS via `var()` with `!default` fallbacks) works around this architectural constraint.

### Layer 3: Runtime JavaScript (scanning + reporting)

**File:** `src/resources/formats/html/axe/axe-check.js`

Single JS file handles all formats at runtime. Format detection uses DOM inspection:
- `typeof Reveal !== "undefined"` → RevealJS
- `document.body.classList.contains("quarto-dashboard")` → Dashboard
- Otherwise → standard HTML

Key classes:
- `QuartoAxeChecker` — Orchestrates scanning. Loads axe-core from CDN, runs scans, creates reporters.
- `QuartoAxeDocumentReporter` — Format-specific DOM report (overlay, slide, or offcanvas)
- `QuartoAxeConsoleReporter` — Logs violations to browser console
- `QuartoAxeJsonReporter` — Dumps full axe result as JSON to console

## Format-Specific Behavior

### HTML (standard)
- Report: overlay appended to `<main>` (or `<body>`)
- Interaction: hover highlights violation elements
- Rescan: none (static page)

### RevealJS
- Report: dedicated `<section>` slide appended to `.reveal .slides`
- Interaction: click navigates to the slide containing the violation
- Scan prep: temporarily removes `hidden`/`aria-hidden` from all slides so axe can inspect them
- Rescan: none (slides are static)

### Dashboard
- Report: Bootstrap offcanvas sidebar with toggle button
- Interaction: hover highlights violation elements
- Rescan: triggered by `shown.bs.tab` (page/card tabs), `popstate` (back/forward), `bslib.sidebar` (sidebar toggle)
- Generation counter prevents stale scan results from overwriting newer ones

## Adding a New HTML Format

If a new HTML-based format is added that needs axe support:

1. **TypeScript** (`format-html.ts`): Add format detection to the axe dependency injection logic
2. **SCSS**: Create format-specific styles if the report placement differs. If the format uses Bootstrap themes, the CSS custom property bridge handles colors automatically.
3. **JavaScript** (`axe-check.js`):
   - Add format detection in `QuartoAxeDocumentReporter.report()` — this determines which `createReport*()` method is called
   - Implement a `createReport*()` method for the format's DOM structure
   - If the format has dynamic content changes, add rescan triggers in `setupDashboardRescan()` (or create a format-specific equivalent)
4. **Tests**: Add Playwright test fixtures (`.qmd` files in `tests/docs/playwright/<format>/`) and parameterized test cases in `axe-accessibility.spec.ts`

## Key Design Decisions

### CDN loading
axe-core (~600KB) is loaded from `cdn.skypack.dev` at runtime rather than bundled. This keeps the Quarto distribution small since axe is a dev-only feature. Tradeoff: requires internet, fails silently in offline/CSP environments.

### Options encoding
Options are base64-encoded in a `<script id="quarto-axe-checker-options">` tag. This prevents JSON containing `</script>` from breaking HTML parsing. The runtime decodes with `atob()`.

### Generation counter (dashboard rescan)
Rapid tab switches can queue multiple `axe.run()` calls. The `scanGeneration` counter ensures only the latest scan's results are displayed. Earlier scans complete but their results are discarded if a newer scan was started.

## Known Limitations

- **SCSS compilation**: RevealJS sass-bundles compile separately from themes. CSS custom properties bridge this gap, but direct SCSS variable sharing isn't possible without pipeline changes.
- **CDN dependency**: No offline fallback. See `quarto-cli-2u4f` for documentation task.
- **Popstate delay**: 50ms `setTimeout` for dashboard back/forward navigation. See `quarto-cli-1fdf` for improvement task.
- **Multi-main elements**: `createReportOverlay()` uses `document.querySelector('main')` which returns the first match. Multiple `<main>` elements is invalid HTML, so this is acceptable.
