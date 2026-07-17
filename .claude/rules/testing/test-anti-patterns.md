---
paths:
  - "tests/**/*.ts"
  - "tests/**/*.test.ts"
---

# Test Anti-Patterns

## Don't: Import `src/quarto.ts` in Tests

A direct `import { quarto } from "src/quarto.ts"` bypasses binary mode (`QUARTO_TEST_BIN`) and always tests the dev sources. Invoke quarto through `testQuartoCmd()`/`runQuarto()` (`tests/quarto-cmd.ts` is the single dispatch point), and resolve subprocess spawns with `quartoDevCmd()` (`tests/utils.ts`).

## Don't: Modify Environment Variables

`Deno.env.set()` modifies process-global state. Deno runs test files in parallel by default, so other tests can see modified values.

**Details:** `llm-docs/testing-patterns.md` → "Environment Variable Testing Pitfalls"

## Don't: Create Language Environments in Test Subdirectories

Never create `Project.toml`, `.venv/`, or `renv.lock` in test fixture directories.

**Details:** `llm-docs/testing-patterns.md` → "Shared Test Environments"
