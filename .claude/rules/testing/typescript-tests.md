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

| File | Purpose |
|------|---------|
| `tests/test.ts` | `testQuartoCmd()`, `testRender()`, `unitTest()` |
| `tests/verify.ts` | Verification functions (`noErrors`, `fileExists`, etc.) |
| `tests/utils.ts` | `docs()`, `outputForInput()`, path utilities |

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
