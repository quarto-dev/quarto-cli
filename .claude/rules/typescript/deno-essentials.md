---
paths:
  - "src/**/*.ts"
---

# TypeScript/Deno Essentials

Core conventions for all TypeScript code in quarto-cli.

## Import Patterns

### Use Import Map Names

```typescript
// Correct - use import map names
import { Command } from "cliffy/command/mod.ts";
import { join, dirname } from "../deno_ral/path.ts";

// Wrong - never hardcode JSR/npm URLs
import { join } from "jsr:/@std/path";
```

### Always Include `.ts` Extensions

```typescript
// Correct
import { debug } from "../../deno_ral/log.ts";

// Wrong - no extension
import { debug } from "../../deno_ral/log";
```

## Deno RAL (Runtime Abstraction Layer)

Import from `src/deno_ral/` instead of standard library directly:

```typescript
// Correct
import { join, dirname } from "../deno_ral/path.ts";
import { existsSync } from "../deno_ral/fs.ts";
import { info, warning } from "../deno_ral/log.ts";

// Wrong - direct std lib import
import { join } from "jsr:/@std/path";
```

Key modules: `fs.ts`, `path.ts`, `log.ts`, `platform.ts`, `process.ts`

## Deno APIs vs Node.js

Use Deno APIs directly:

```typescript
// Correct - Deno APIs
Deno.env.get("PATH");
Deno.cwd();
Deno.readTextFileSync(path);
Deno.writeTextFileSync(path, content);
Deno.makeTempDirSync({ prefix: "quarto" });

// Wrong - Node.js patterns
process.env.PATH;
fs.readFileSync(path);
```

## Sync vs Async

Prefer sync APIs in CLI handlers for simpler code flow. Use async for I/O-heavy parallel operations.

## Lint Directives

Common directives (use sparingly):
- `no-explicit-any` - For Cliffy options, JSON parsing
- `no-control-regex` - For regex with control characters

## Key Conventions

1. **Use import map names** - Never hardcode JSR/npm URLs
2. **Include `.ts` extensions** - Required for Deno resolution
3. **Import from deno_ral** - Not directly from std library
4. **Use Deno APIs** - No Node.js equivalents
5. **Prefer sync APIs** - Simpler code flow for CLI
