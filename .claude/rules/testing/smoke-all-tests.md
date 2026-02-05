---
paths:
  - "tests/docs/smoke-all/**/*.qmd"
  - "tests/docs/smoke-all/**/*.md"
  - "tests/docs/smoke-all/**/*.ipynb"
  - "tests/smoke/smoke-all.test.ts"
  - "tests/verify.ts"
---

# Smoke-All Test Format

Document-based tests using YAML metadata for verification. Tests live in `tests/docs/smoke-all/`.

## Running Tests

```bash
# Linux/macOS
./run-tests.sh docs/smoke-all/path/to/test.qmd
./run-tests.sh docs/smoke-all/2023/**/*.qmd  # Glob pattern

# Windows
.\run-tests.ps1 docs/smoke-all/path/to/test.qmd
```

## Test Structure

Tests are defined in `_quarto.tests` YAML metadata:

```yaml
---
title: My Test
_quarto:
  tests:
    html:                              # Format to test
      ensureHtmlElements:              # Verification function
        - ['div.callout']              # Must exist
        - ['div.error', false]         # Must NOT exist
---
```

## Available Verification Functions

See `tests/smoke/smoke-all.test.ts` for the `verifyMap` that defines available functions.

Common patterns:

```yaml
_quarto:
  tests:
    html:
      ensureHtmlElements:
        - ['div.callout']              # Element must exist
        - ['div.error', false]         # Element must NOT exist
      noErrorsOrWarnings: []           # Clean render (default)
      noErrors: []                     # Allow warnings

    typst:
      ensureTypstFileRegexMatches:     # Requires keep-typ: true
        - ['#callout\(']

    pdf:
      ensureLatexFileRegexMatches:     # Requires keep-tex: true
        - ['\\begin\{figure\}']
```

### Message Verification

Lua `warn()` appears as `level: INFO` on TypeScript side:

```yaml
_quarto:
  tests:
    html:
      printsMessage:
        level: INFO
        regex: 'WARNING(.*)text'
        negate: false                  # Set true to verify absence
```

### Snapshot Testing

```yaml
_quarto:
  tests:
    html:
      ensureSnapshotMatches: []
```

Save snapshot as `output.html.snapshot` alongside expected output.

## Execution Control

```yaml
_quarto:
  tests:
    run:
      skip: true                       # Skip unconditionally
      skip: "Reason for skipping"      # Skip with message
      ci: false                        # Skip on CI only
      os: darwin                       # Run only on macOS
      os: [windows, darwin]            # Run on Windows or macOS
      not_os: linux                    # Don't run on Linux
```

Valid OS values: `linux`, `darwin`, `windows`

## YAML String Escaping for Regex

**Details:** `llm-docs/testing-patterns.md` → "YAML String Escaping for Regex"

**Quick rule:** In YAML single quotes, use single backslash: `'\('` matches `\(`. Double-escaping `'\\('` is wrong.

## File Organization

**Issue-based:** `tests/docs/smoke-all/YYYY/MM/DD/<issue>.qmd`
**Feature-based:** `tests/docs/smoke-all/<feature>/`

## Creating New Tests

```bash
# Linux/macOS
./new-smoke-all-test.sh 13589

# Windows
.\new-smoke-all-test.ps1 13589
```
