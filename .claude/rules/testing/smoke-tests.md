---
paths:
  - "tests/smoke/**/*.test.ts"
---

# Smoke Tests

TypeScript-based tests that render documents and verify output. Tests live in `tests/smoke/`.

## Running Tests

```bash
# Linux/macOS
./run-tests.sh smoke/render/render.test.ts
./run-tests.sh smoke/extensions/

# Windows
.\run-tests.ps1 smoke/render/render.test.ts
```

## Core Infrastructure

| File | Purpose |
|------|---------|
| `tests/test.ts` | `testQuartoCmd()`, `testRender()`, test context |
| `tests/verify.ts` | All verification functions |
| `tests/utils.ts` | `docs()`, `outputForInput()`, path utilities |
| `tests/verify-snapshot.ts` | Snapshot comparison utilities |

## Feature-Specific Utilities

| File | Purpose |
|------|---------|
| `smoke/render/render.ts` | `testRender()` wrapper, `cleanoutput()` |
| `smoke/site/site.ts` | `testSite()` for website rendering |
| `smoke/website/draft-utils.ts` | Draft post verification helpers |
| `smoke/project/common.ts` | Project testing utilities |
| `smoke/crossref/utils.ts` | Cross-reference verification |
| `smoke/manuscript/manuscript.ts` | Manuscript testing helpers |
| `smoke/jats/render-jats-metadata.ts` | JATS metadata verification |
| `smoke/convert/convert.ts` | Conversion testing utilities |

## Basic Test Pattern

```typescript
import { testRender } from "./render.ts";
import { noErrorsOrWarnings } from "../../verify.ts";
import { docs } from "../../utils.ts";

const inputDir = docs("my-feature/");

testRender(
  "test.qmd",           // Input file
  "html",               // Format
  false,                // Keep output?
  [noErrorsOrWarnings], // Verifications
  { cwd: () => inputDir }
);
```

## Test with Setup/Teardown

```typescript
testRender("test.qmd", "html", false, [noErrorsOrWarnings], {
  cwd: () => inputDir,
  setup: async () => {
    // Create temp files, set up state
  },
  teardown: async () => {
    // Clean up temp files
  },
});
```

## Test Organization

```
tests/smoke/
├── render/          # General rendering tests
├── crossref/        # Cross-reference tests
├── extensions/      # Extension tests
├── project/         # Project rendering tests
├── site/            # Site/blog tests
├── website/         # Website-specific tests
└── <feature>/       # Feature-specific tests
```

Test fixtures go in `tests/docs/<feature>/`.
