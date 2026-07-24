---
paths:
  - "tests/**"
---

# Test Infrastructure

Quarto's test suite lives in `tests/`. For comprehensive documentation, see `tests/README.md`.

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

**Binary mode:** set `QUARTO_TEST_BIN` to a built quarto (extracted outside the checkout — the runner refuses the 99.9.9 dev sentinel) to spawn it instead of running the dev sources in-process; defaults to `smoke/` (`unit/` is dev-only; the playwright suite and ff-matrix corpus are binary-compatible and run as their own CI legs in `test-smokes-built.yml`, or locally by passing them explicitly). See `tests/README.md` → "Binary mode"; architecture and design decisions in `llm-docs/built-version-testing-architecture.md`.

## Test Types

| Type | Location | File Pattern | Details |
|------|----------|--------------|---------|
| Unit | `tests/unit/` | `*.test.ts` | `.claude/rules/testing/typescript-tests.md` |
| Smoke | `tests/smoke/` | `*.test.ts` | `.claude/rules/testing/typescript-tests.md` |
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
| `quarto-cmd.ts` | Quarto invocation dispatch (`runQuarto`; in-process dev vs `QUARTO_TEST_BIN` binary mode) |
| `verify.ts` | Verification functions |
| `utils.ts` | Path utilities (`docs()`, `outputForInput()`) |
| `README.md` | Comprehensive documentation |

## Debugging

1. Run single test to isolate failures
2. Check render output - tests capture stdout/stderr
3. VSCode debugging via `.vscode/launch.json`
4. Flaky test methodology: [dev-docs/debugging-flaky-tests.md](../../../dev-docs/debugging-flaky-tests.md)
