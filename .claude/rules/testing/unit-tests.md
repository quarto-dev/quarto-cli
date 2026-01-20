---
paths:
  - "tests/unit/**/*.test.ts"
---

# Unit Tests

TypeScript-based tests for isolated functionality. Tests live in `tests/unit/`.

## Running Tests

```bash
# Linux/macOS
./run-tests.sh unit/path.test.ts
./run-tests.sh unit/                    # All unit tests

# Windows
.\run-tests.ps1 unit/path.test.ts
```

## Test Structure

Unit tests use `unitTest()` from `tests/test.ts` with standard assertions:

```typescript
import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";

// deno-lint-ignore require-await
unitTest("feature - description", async () => {
  const result = myFunction(input);
  assert(result === expected, "Error message");
});
```

## Assertions

From `testing/asserts` (Deno standard library):

```typescript
import {
  assert,           // Boolean check
  assertEquals,     // Deep equality
  assertNotEquals,  // Deep inequality
  assertThrows,     // Exception check
  assertRejects,    // Async exception check
} from "testing/asserts";
```

## Test Organization

```
tests/unit/
├── schema-validation/   # Schema tests
├── mapped-strings/      # String mapping tests
├── yaml-intelligence/   # YAML completion tests
└── <feature>.test.ts    # Feature-specific tests
```

Some directories have their own `utils.ts` for shared helpers.

## Common Patterns

### Test with temp files

```typescript
const workingDir = Deno.makeTempDirSync({ prefix: "quarto-test" });

unitTest("feature - with temp files", async () => {
  const testFile = join(workingDir, "test.txt");
  Deno.writeTextFileSync(testFile, "content");

  // Test...

  Deno.removeSync(testFile);
});
```

### Test with fixtures

```typescript
import { docs } from "../utils.ts";

const fixtureDir = docs("my-fixture");

unitTest("feature - with fixtures", async () => {
  // fixtureDir points to tests/docs/my-fixture/
});
```

### Async tests

Most tests are marked `async` but don't actually await:

```typescript
// deno-lint-ignore require-await
unitTest("sync test", async () => {
  // Synchronous test code
});
```

For actual async:

```typescript
unitTest("async test", async () => {
  const result = await asyncFunction();
  assertEquals(result, expected);
});
```
