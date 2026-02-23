---
paths:
  - "src/deno_ral/**/*.ts"
---

# Deno RAL (Runtime Abstraction Layer)

The `deno_ral/` directory provides a runtime abstraction layer over Deno's standard library. All code should import from here instead of directly from std.

## Available Modules

| Module | Purpose | Key exports |
|--------|---------|-------------|
| `fs.ts` | File system | `existsSync`, `ensureDirSync`, `copySync`, `safeMoveSync`, `safeRemoveSync` |
| `path.ts` | Path utilities | `join`, `dirname`, `basename`, `extname` |
| `log.ts` | Logging | `debug`, `info`, `warning`, `error` |
| `platform.ts` | Platform detection | `isWindows` |
| `process.ts` | Process execution | Process utilities |

## Why Use deno_ral

- Consistent API across the codebase
- Abstraction allows future runtime changes
- Import map resolution works correctly
- Avoids scattered `jsr:/@std/*` imports

## Common Utilities

**Temp files** (`src/core/temp.ts`):
```typescript
import { createTempContext } from "../core/temp.ts";

const temp = createTempContext();
try {
  const tempFile = temp.createFile({ suffix: ".json" });
} finally {
  temp.cleanup();
}
```

**Process execution** (`src/core/process.ts`):
```typescript
import { execProcess } from "../core/process.ts";

const result = await execProcess({
  cmd: ["pandoc", "--version"],
  stdout: "piped",
});
```

## Safe File Operations

`deno_ral/fs.ts` provides safe wrappers over raw Deno APIs. Prefer these:

- **`safeMoveSync(src, dest)`** — Use instead of `Deno.renameSync`. Handles cross-device moves by falling back to copy+delete on `EXDEV` errors.
- **`safeRemoveSync(path, options)`** — Use instead of `Deno.removeSync`. Tolerates already-removed paths (no error if file doesn't exist).
- **`safeRemoveDirSync(path, boundary)`** — Safe recursive removal that refuses to delete outside the boundary directory.

## Module Loading Order

`src/quarto.ts` loads monkey patches first:
```typescript
import "./core/deno/monkey-patch.ts";  // Must be first!
```

This ensures compatibility shims load before any code runs.
