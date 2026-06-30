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

### Regex Match Array Format

`ensureFileRegexMatches` (and variants like `ensureTypstFileRegexMatches`, `ensureLatexFileRegexMatches`) takes two arrays:

```yaml
ensureFileRegexMatches:
  -                                   # First array: patterns that MUST match
    - "pattern1"
    - "pattern2"
  -                                   # Second array (optional): patterns that must NOT match
    - "forbidden-pattern"
```

Both patterns in the first array must be found. Any pattern in the second array causes failure if found.

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

## Pattern Specificity

Avoid patterns that match template boilerplate instead of document content:

- Bad: `'#figure\('` - matches any figure including template definitions
- Good: `'#figure\(\[(\r\n?|\n)#block\['` - matches specific document structure

**Line breaks:** `(\r\n?|\n)` for exact line breaks; `\s*` or `\s+` for flexible whitespace.

**Examples:** `tests/docs/smoke-all/typst/`, `tests/docs/smoke-all/crossrefs/`

## Documenting Test Intent

Put scenario explanation — what the document tests, why the bug existed, what each case exercises — in the document **body** as prose, not in YAML frontmatter comments. This is the de-facto pattern for issue-regression tests (see `tests/docs/smoke-all/2025/01/23/issue-13603.qmd`, `tests/docs/smoke-all/2025/04/04/12295.qmd`).

Keep the `_quarto: tests:` block assertion-focused, but inline `#` comments labeling individual non-obvious regex/selector strings are fine and encouraged — especially in long or negative-match arrays where the target is otherwise opaque (see `tests/docs/smoke-all/2023/11/02/7262.qmd`). The two locations are complementary: body prose explains the scenario; inline comments label what a specific assertion checks. Avoid top-of-block narrative comment paragraphs — those belong in the body.

## YAML String Escaping for Regex

**Details:** `llm-docs/testing-patterns.md` → "YAML String Escaping for Regex"

**Quick rule:** In YAML single quotes, use single backslash: `'\('` matches `\(`. Double-escaping `'\\('` is wrong.

## File Organization

**Issue-based:** `tests/docs/smoke-all/YYYY/MM/DD/<issue>.qmd`
**Feature-based:** `tests/docs/smoke-all/<feature>/`

### Many fixtures: prefer a dynamic smoke test

Every non-`_`-prefixed `.qmd` under `smoke-all/` is globbed and rendered as its own test target. When a test needs many fixture files (e.g. dozens of pages to reproduce a project-level bug), each stored page becomes a redundant per-file render — plus repo bloat — on top of the project render. Generate the project in a temp directory from a TypeScript `tests/smoke/<feature>/` test instead (`testQuartoCmd("render", [tempDir], ...)` with `setup`/`teardown`). See the "Project Rendering Tests" and "Performance Budget" patterns in `llm-docs/testing-patterns.md`.

## Creating New Tests

```bash
# Linux/macOS
./new-smoke-all-test.sh 13589

# Windows
.\new-smoke-all-test.ps1 13589
```
