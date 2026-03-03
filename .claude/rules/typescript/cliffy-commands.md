---
paths:
  - "src/command/**/*.ts"
---

# Cliffy Command Pattern

Commands use the Cliffy library and follow this structure:

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

**Options typed as `any`:** Required due to Cliffy limitations.

**Registration:** Export from `src/command/<name>/cmd.ts`, register in `src/command/command.ts`.

## Error Handling

Use custom error classes from `src/core/lib/error.ts`:

```typescript
import { InternalError, ErrorEx, asErrorEx } from "../core/lib/error.ts";

// Programming errors (bugs)
throw new InternalError("This should never happen");

// User-facing errors
throw new ErrorEx("User-facing error message");

// Normalize unknown errors
try {
  riskyOperation();
} catch (e) {
  const err = asErrorEx(e);
  error(err.message);
}
```
