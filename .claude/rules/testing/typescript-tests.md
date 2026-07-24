---
paths:
  - "tests/smoke/**/*.test.ts"
  - "tests/unit/**/*.test.ts"
---

# TypeScript Tests

TypeScript-based tests using Deno. Smoke tests render documents; unit tests verify isolated functionality.

## Running Tests

```bash
# Linux/macOS
./run-tests.sh smoke/render/render.test.ts    # Specific smoke test
./run-tests.sh unit/path.test.ts              # Specific unit test
./run-tests.sh smoke/extensions/              # Directory

# Windows
.\run-tests.ps1 smoke/render/render.test.ts
```

## Core Infrastructure

Core test files (`test.ts`, `quarto-cmd.ts`, `verify.ts`, `utils.ts`) are described in `.claude/rules/testing/overview.md` § Core Files.

### Binary mode compatibility

Tests must keep working when `QUARTO_TEST_BIN` targets a built quarto (binary mode) instead of the in-process dev sources:

- Never `import { quarto } from "../../src/quarto.ts"` in tests — invoke quarto via `testQuartoCmd()`/`runQuarto()`.
- Subprocess spawns of quarto: resolve the executable with `quartoDevCmd()` (`tests/utils.ts`, honors `QUARTO_TEST_BIN`) or `quartoDevBinCmd()` (`tests/quarto-cmd.ts`, pins the local dev build), and pass `quartoSpawnEnvOptions()` as spawn env options.
- `TestContext.requiresDevQuarto: true` ignores a test in binary mode — rare escape hatch for tests exercising quarto internals in-process.

### Search for an existing verifier before writing one

`verify.ts` already covers many output shapes — including parsed-content
verifiers, not just raw-text regex (e.g. `ensureIpynbCellMatches` JSON-parses a
notebook and matches against joined cell source; `ensureHtmlElements` /
`ensureHtmlSelectorSatisfies` parse the DOM). Before adding a new `Verify`,
grep `verify.ts` for the format or assertion you need. Reuse or extend the
existing helper rather than hand-rolling a near-duplicate. Same applies to
mock-context and fixture helpers in `tests/unit/**` and `tests/utils.ts`.

## Smoke Tests (`tests/smoke/`)

Render documents and verify output:

```typescript
import { testRender } from "./render.ts";
import { noErrorsOrWarnings } from "../../verify.ts";
import { docs } from "../../utils.ts";

testRender(
  "test.qmd",
  "html",
  false,                // Keep output?
  [noErrorsOrWarnings],
  { cwd: () => docs("my-feature/") }
);
```

With setup/teardown:
```typescript
testRender("test.qmd", "html", false, [noErrorsOrWarnings], {
  cwd: () => inputDir,
  setup: async () => { /* Create temp files */ },
  teardown: async () => { /* Cleanup */ },
});
```

## Unit Tests (`tests/unit/`)

Test isolated functionality:

```typescript
import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";

// deno-lint-ignore require-await
unitTest("feature - description", async () => {
  const result = myFunction(input);
  assertEquals(result, expected);
});
```

Assertions from `testing/asserts`: `assert`, `assertEquals`, `assertThrows`, `assertRejects`

## Common Patterns

**Temp files:**
```typescript
const workingDir = Deno.makeTempDirSync({ prefix: "quarto-test" });
// Use workingDir, clean up in teardown
```

**Fixtures:**
```typescript
const fixtureDir = docs("my-fixture");  // → tests/docs/my-fixture/
```

## Test Organization

- `tests/smoke/<feature>/` - Smoke tests by feature
- `tests/unit/<feature>/` - Unit tests by feature
- `tests/docs/<feature>/` - Test fixtures

**Details:** `llm-docs/testing-patterns.md` for comprehensive patterns and examples.

## Common Test Utilities

**Constructing `MappedString` values:**
```typescript
import { asMappedString } from "../../../src/core/lib/mapped-text.ts";

// Use asMappedString("") instead of casting or constructing MappedString manually
const markdown = asMappedString("");
const markdownWithContent = asMappedString("# Title\nSome content");
```

**Mock Contexts:**

Several subsystems use context interfaces passed to functions. For unit tests, create `createMock*()` helpers with no-op stubs. Key pattern: async callbacks (like `withSpinner`) should just `await op()` so errors propagate normally. Check existing test files for helpers before writing new ones.

| Context | Interface | Existing helpers |
|---------|-----------|-----------------|
| `ProjectContext` | `src/project/types.ts` | `tests/unit/project/utils.ts` → `createMockProjectContext()` |
| `InstallContext` | `src/tools/types.ts` | `tests/unit/tools/chrome-headless-shell.test.ts` → `createMockContext()` |
