---
paths:
  - "src/**/*.ts"
---

# TypeScript/Deno Development Conventions

Guidance for developing TypeScript code in the quarto-cli codebase using Deno.

## Import Patterns

### Use Import Map Names

```typescript
// ✅ Correct - use import map names
import { Command } from "cliffy/command/mod.ts";
import { join, dirname } from "../deno_ral/path.ts";

// ❌ Wrong - never hardcode JSR/npm URLs in imports
import { join } from "jsr:/@std/path";
import { z } from "npm:zod";
```

### Always Include `.ts` Extensions

Required for Deno module resolution:

```typescript
// ✅ Correct
import { debug } from "../../deno_ral/log.ts";

// ❌ Wrong - no extension
import { debug } from "../../deno_ral/log";
```

## Deno RAL (Runtime Abstraction Layer)

Always import from `src/deno_ral/` rather than using standard library directly:

```typescript
// ✅ Correct - use abstraction layer
import { join, dirname } from "../deno_ral/path.ts";
import { existsSync, ensureDirSync } from "../deno_ral/fs.ts";
import { info, warning, error } from "../deno_ral/log.ts";

// ❌ Wrong - direct std lib import
import { join } from "jsr:/@std/path";
```

**Key deno_ral modules:**
- `deno_ral/fs.ts` - File system operations
- `deno_ral/path.ts` - Path utilities
- `deno_ral/log.ts` - Logging (debug, info, warning, error)
- `deno_ral/platform.ts` - Platform detection (`isWindows`)
- `deno_ral/process.ts` - Process execution

## Deno APIs vs Node.js

**Use Deno APIs directly**, not Node.js equivalents:

```typescript
// ✅ Correct - Deno APIs
Deno.env.get("PATH");
Deno.cwd();
Deno.readTextFileSync(path);
Deno.writeTextFileSync(path, content);
Deno.statSync(path);
Deno.makeTempDirSync({ prefix: "quarto" });
Deno.removeSync(path, { recursive: true });

// ❌ Wrong - Node.js patterns
process.env.PATH;
process.cwd();
fs.readFileSync(path);
```

## Sync vs Async

**Prefer sync APIs** in CLI command handlers for simpler code flow:

```typescript
// ✅ Typical CLI command - sync is fine
const content = Deno.readTextFileSync(path);
const parsed = JSON.parse(content);

// ✅ Use async for I/O-heavy operations
const results = await Promise.all([
  fetchRemoteData(url1),
  fetchRemoteData(url2),
]);
```

## Cliffy Command Pattern

Commands follow this structure:

```typescript
export const myCommand = new Command()
  .name("command-name")
  .description("What the command does")
  .arguments("[input:string]")
  .option("-f, --flag", "Flag description")
  .option("-o, --output <path:string>", "Option with value")
  .example("Basic usage", "quarto command input.qmd")
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input?: string) => {
    // Implementation
  });
```

**Note:** Options must be typed as `any` due to Cliffy limitations.

**Registration:** Export from `src/command/<name>/cmd.ts`, register in `src/command/command.ts`.

## Error Handling

Use custom error classes from `src/core/lib/error.ts`:

```typescript
import { InternalError, ErrorEx } from "../core/lib/error.ts";

// Programming errors (bugs)
throw new InternalError("This should never happen");

// General errors with better stack traces
throw new ErrorEx("User-facing error message");

// Normalize unknown errors
try {
  riskyOperation();
} catch (e) {
  const err = asErrorEx(e);
  error(err.message);
}
```

## Lint Directives

Use sparingly, only when necessary:

```typescript
// deno-lint-ignore no-explicit-any
.action(async (options: any, input?: string) => {
  // Cliffy requires any for options
});
```

Common directives:
- `no-explicit-any` - For Cliffy options, JSON parsing
- `no-control-regex` - For regex with control characters

## Path Handling

```typescript
import { normalizePath } from "../core/path.ts";
import { isWindows } from "../deno_ral/platform.ts";

// Normalize paths for consistent comparison
const normalized = normalizePath(Deno.cwd());

// Platform-specific logic
if (isWindows) {
  // Windows-specific handling
}
```

## Common Utilities

**Temp files:** (`src/core/temp.ts`)
```typescript
import { createTempContext, globalTempContext } from "../core/temp.ts";

// Scoped temp context with cleanup
const temp = createTempContext();
try {
  const tempFile = temp.createFile({ suffix: ".json" });
  // Use tempFile...
} finally {
  temp.cleanup();
}
```

**Process execution:** (`src/core/process.ts`)
```typescript
import { execProcess } from "../core/process.ts";

const result = await execProcess({
  cmd: ["pandoc", "--version"],
  stdout: "piped",
});
```

## Module Loading Order

`src/quarto.ts` loads monkey patches first:
```typescript
import "./core/deno/monkey-patch.ts";  // Must be first!
// ... rest of imports
```

This ensures compatibility shims are loaded before any code runs.

## Key Conventions Summary

1. **Use import map names** - Never hardcode JSR/npm URLs
2. **Include `.ts` extensions** - Required for Deno resolution
3. **Import from deno_ral** - Not directly from std library
4. **Use Deno APIs** - No Node.js equivalents
5. **Prefer sync APIs** - Simpler code flow for CLI
6. **Type options as `any`** - Cliffy limitation
7. **Use custom error classes** - Better error handling
8. **Normalize paths** - Use `normalizePath()` for consistency
