---
paths:
  - "tests/**/*.ts"
  - "tests/**/*.test.ts"
---

# Test Anti-Patterns

## Don't: Modify Environment Variables

`Deno.env.set()` modifies process-global state. Deno runs test files in parallel by default, so other tests can see modified values.

**Details:** `llm-docs/testing-patterns.md` → "Environment Variable Testing Pitfalls"

## Don't: Create Language Environments in Test Subdirectories

Never create `Project.toml`, `.venv/`, or `renv.lock` in test fixture directories.

**Details:** `llm-docs/testing-patterns.md` → "Shared Test Environments"

## Don't: `Deno.chdir()` inside the test body

`Deno.chdir()` mutates process-global cwd, so a test that changes it can leak into other tests in the same process. The harness already changes and restores the working directory: return the directory from `TestContext.cwd`, create fixtures in `setup`, clean up in `teardown` (examples: `tests/unit/dotenv-config.test.ts`, `tests/smoke/use/template.test.ts`). For a temp directory you don't need to run *from*, use `withTempDir` (`tests/utils.ts`). A test that only needs a *relative* input can pass a path relative to the current cwd without changing it.

**Details:** `llm-docs/testing-patterns.md` → "Working-Directory-Sensitive Tests"
