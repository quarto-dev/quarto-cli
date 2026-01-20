# Test Infrastructure

This directory contains Quarto's test suite. For comprehensive documentation, see `README.md`.

## Running Tests

```bash
cd tests

# Linux/macOS
./run-tests.sh                              # All tests
./run-tests.sh smoke/render/render.test.ts  # Specific test
./run-tests.sh docs/smoke-all/path/test.qmd # Smoke-all document

# Windows (PowerShell 7+)
.\run-tests.ps1
.\run-tests.ps1 smoke/render/render.test.ts
```

**Skip dependency configuration:**
```bash
QUARTO_TESTS_NO_CONFIG="true" ./run-tests.sh test.ts    # Linux/macOS
$env:QUARTO_TESTS_NO_CONFIG=$true; .\run-tests.ps1      # Windows
```

## Test Types

| Type | Location | File Pattern | Details |
|------|----------|--------------|---------|
| Unit | `tests/unit/` | `*.test.ts` | `.claude/rules/testing/unit-tests.md` |
| Smoke | `tests/smoke/` | `*.test.ts` | `.claude/rules/testing/smoke-tests.md` |
| Smoke-all | `tests/docs/smoke-all/` | `*.qmd` | `.claude/rules/testing/smoke-all-tests.md` |
| Playwright | `tests/integration/playwright/` | `*.spec.ts` | `.claude/rules/testing/playwright-tests.md` |

## Dependencies

Tests require R, Python, and Julia. Run configuration script to set up:

```bash
# Linux/macOS
./configure-test-env.sh

# Windows
.\configure-test-env.ps1
```

Managed via:
- **R**: renv (`renv.lock`)
- **Python**: uv (`pyproject.toml`, `uv.lock`)
- **Julia**: Pkg.jl (`Project.toml`, `Manifest.toml`)

## Core Files

| File | Purpose |
|------|---------|
| `test.ts` | Test infrastructure (`testQuartoCmd`, `unitTest`) |
| `verify.ts` | Verification functions |
| `utils.ts` | Path utilities (`docs()`, `outputForInput()`) |
| `README.md` | Comprehensive documentation |

## Debugging

1. Run single test to isolate failures
2. Check render output - tests capture stdout/stderr
3. VSCode debugging via `.vscode/launch.json`

## Related Documentation

- **Full test docs**: `tests/README.md`
- **Flaky test debugging**: https://gist.github.com/cderv/77405f5a5ea0c1db38693159c4a260dd
