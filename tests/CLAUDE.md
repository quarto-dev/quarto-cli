# Test Infrastructure

This directory contains Quarto's test suite. For comprehensive documentation, see `README.md` in this directory.

## Quick Reference

### Running Tests

```bash
cd tests

# Linux/macOS
./run-tests.sh                                    # All tests
./run-tests.sh smoke/render/render.test.ts        # Specific test file
./run-tests.sh docs/smoke-all/path/to/test.qmd    # Smoke-all document

# Windows (PowerShell 7+)
.\run-tests.ps1                                    # All tests
.\run-tests.ps1 smoke/render/render.test.ts        # Specific test file
.\run-tests.ps1 docs/smoke-all/path/to/test.qmd    # Smoke-all document
```

**Skip dependency configuration:**
```bash
# Linux/macOS
QUARTO_TESTS_NO_CONFIG="true" ./run-tests.sh test.ts

# Windows
$env:QUARTO_TESTS_NO_CONFIG=$true; .\run-tests.ps1 test.ts
```

## Test Structure

```
tests/
├── unit/          # Unit tests
├── integration/   # Integration tests
├── smoke/         # Smoke tests (.test.ts files)
├── docs/          # Test fixtures
│   └── smoke-all/ # Document-based tests (.qmd files)
├── verify.ts      # Verification functions
└── utils.ts       # Test utilities
```

## Smoke-All Test Format

Document-based tests use `_quarto.tests` YAML metadata:

```yaml
---
title: My Test
_quarto:
  tests:
    html:
      ensureHtmlElements:
        - ['div.callout']      # Must exist
        - ['div.error', false] # Must NOT exist
    typst:
      ensureTypstFileRegexMatches:
        - ['#callout\(']       # Pattern must match
        - ['ERROR']            # Pattern must NOT match
---
```

**Requires intermediate file preservation:**
- Typst: Add `keep-typ: true` to frontmatter
- LaTeX: Add `keep-tex: true` to frontmatter

## Key Verification Functions

From `verify.ts`:

| Function | Purpose |
|----------|---------|
| `ensureHtmlElements` | Check HTML element presence |
| `ensureTypstFileRegexMatches` | Check Typst source patterns |
| `ensureLatexFileRegexMatches` | Check LaTeX source patterns |
| `ensureFileRegexMatches` | Check any file content |
| `printsMessage` | Verify render output messages |
| `ensureSnapshotMatches` | Compare against saved snapshot |
| `noErrors`, `noErrorsOrWarnings` | Verify clean rendering |

## Message Verification

**Important**: Lua `warn()` appears as `level: INFO` on TypeScript side:

```yaml
_quarto:
  tests:
    html:
      # Verify Lua warning appears
      printsMessage: { level: INFO, regex: 'WARNING(.*)text' }

      # Verify message does NOT appear
      printsMessage: { level: INFO, regex: 'ERROR', negate: true }
```

## Test Control Metadata

```yaml
_quarto:
  tests:
    run:
      skip: true                    # Skip unconditionally
      skip: "Reason for skipping"   # Skip with message
      ci: false                     # Skip on CI only
      os: darwin                    # Run only on macOS
      os: [windows, darwin]         # Run on Windows or macOS
      not_os: linux                 # Don't run on Linux
```

Valid OS values: `linux`, `darwin`, `windows`

## Test Organization

**Issue-based tests:** `tests/docs/smoke-all/YYYY/MM/DD/`
- Filename: Issue number (e.g., `13589.qmd`)
- Multiple related: `13589.qmd`, `13589-valid.qmd`
- Reference issue in title: `"Bug with feature (#13589)"`

**Feature tests:** `tests/docs/smoke-all/<feature>/`
- Examples: `typst/`, `crossrefs/`, `html/`

## Common Patterns

### Regex Best Practices

**Be specific to avoid template matches:**
```yaml
# Bad - matches template boilerplate
- ['#figure\(']

# Good - matches specific document structure
- ['#figure\(\[(\r\n?|\n)#block\[(\r\n?|\n)#callout']
```

**Line breaks:**
- `\s*` - Zero or more whitespace (spaces, tabs, newlines)
- `(\r\n?|\n)` - Only line breaks (Windows or Unix)

### Snapshot Testing

```yaml
_quarto:
  tests:
    html:
      ensureSnapshotMatches: []
```

Save snapshot file as `output.html.snapshot` alongside expected output.

## Dependencies

Tests require R, Python, and Julia. Run configuration script:
```bash
# Linux/macOS
./configure-test-env.sh

# Windows
.\configure-test-env.ps1
```

Or set `QUARTO_TESTS_NO_CONFIG=true` to skip.

## Debugging Tests

1. **Run single test** to isolate failures
2. **Check render output** - tests capture stdout/stderr
3. **Keep intermediate files** - Add `keep-typ: true` or `keep-tex: true`
4. **VSCode debugging** - See `.vscode/launch.json` configuration

## Related Documentation

- **Full test docs**: `tests/README.md`
- **Flaky test debugging**: https://gist.github.com/cderv/77405f5a5ea0c1db38693159c4a260dd
- **Rule file**: `.claude/rules/testing/smoke-all-format.md`
