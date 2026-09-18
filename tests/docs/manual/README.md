# Manual Tests

Tests that require interactive sessions, external services, or browser access that cannot run in automated CI.

## Test Suites

| Directory / File | Area | Skill | Description |
|-----------------|------|-------|-------------|
| `preview/` | `quarto preview` | `/quarto-preview-test` | Live preview server behavior: URL routing, file watching, live reload, transient file cleanup |
| `publish-connect-cloud/` | `quarto publish` | — | Posit Connect Cloud publishing with OAuth flow |
| `mermaid-svg-pdf-tooling.qmd` | `quarto render` | — | Mermaid SVG rendering to PDF with external tooling (rsvg-convert) |

## Running Tests

Each suite has its own README with test matrix and execution instructions. Test fixtures live alongside the README in each directory.

For preview tests, use the `/quarto-preview-test` skill which automates the start-verify-cleanup cycle.
