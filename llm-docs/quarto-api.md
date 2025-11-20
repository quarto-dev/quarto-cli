# Quarto API and @quarto/types

## Building @quarto/types

To build the @quarto/types package:

```
cd packages/quarto-types
npm run build
```

This runs typecheck and then bundles all type definitions into `dist/index.d.ts`.

---

## Updating the Quarto API

The Quarto API is how external execution engines access Quarto's core functionality. The API exists in two places:

1. **Type definitions** in `packages/quarto-types/` - consumed by external engines (TypeScript)
2. **Implementation** in `src/core/quarto-api.ts` - used within quarto-cli

### Step-by-step: Adding to the Quarto API

Follow these steps in order when adding new functionality to the API:

#### 1. Update quarto-types type definitions

**Add auxiliary types** (if needed):

- Types belong in `packages/quarto-types/src/`
- Follow the existing file organization:
  - `system.ts` - System/process types (ProcessResult, TempContext, etc.)
  - `console.ts` - Console/UI types (SpinnerOptions, etc.)
  - `jupyter.ts` - Jupyter-specific types
  - `check.ts` - Check command types
  - `execution.ts` - Execution engine types
  - etc.
- Create new files if needed for logical grouping

**Export types from index.ts:**

```typescript
// In packages/quarto-types/src/index.ts
export type * from "./your-new-file.ts";
```

**Add to QuartoAPI interface:**

```typescript
// In packages/quarto-types/src/quarto-api.ts

// 1. Import any new types at the top
import type { YourNewType } from "./your-file.ts";

// 2. Add to the QuartoAPI interface
export interface QuartoAPI {
  // ... existing namespaces

  yourNamespace: {
    yourMethod: (param: YourNewType) => ReturnType;
  };
}
```

#### 2. Test the type definitions

```bash
cd packages/quarto-types
npm run build
```

This will:

- Run `tsc --noEmit` to typecheck
- Bundle types into `dist/index.d.ts`
- Show any type errors

Fix any errors before proceeding.

#### 3. Update the internal QuartoAPI interface

The file `src/core/quarto-api.ts` contains a **duplicate** QuartoAPI interface definition used for the internal implementation. Update it to match:

```typescript
// In src/core/quarto-api.ts (near top of file)
export interface QuartoAPI {
  // ... existing namespaces

  yourNamespace: {
    yourMethod: (param: YourNewType) => ReturnType;
  };
}
```

**Note:** This interface must match the one in quarto-types, but uses internal types.

#### 4. Wire up the implementation

Still in `src/core/quarto-api.ts`:

**Add imports** (near top):

```typescript
import { yourMethod } from "./your-module.ts";
```

**Add to quartoAPI object** (at bottom):

```typescript
export const quartoAPI: QuartoAPI = {
  // ... existing namespaces

  yourNamespace: {
    yourMethod,
  },
};
```

#### 5. Verify with typecheck

Run the quarto typecheck:

```bash
package/dist/bin/quarto
```

No output means success! Fix any type errors.

#### 6. Commit with built artifact

**Always commit the built `dist/index.d.ts` file** along with source changes:

```bash
git add packages/quarto-types/src/your-file.ts \
        packages/quarto-types/src/index.ts \
        packages/quarto-types/src/quarto-api.ts \
        packages/quarto-types/dist/index.d.ts \
        src/core/quarto-api.ts

git commit -m "Add yourNamespace to Quarto API"
```

### Using the Quarto API in source files

#### Inside quarto-cli (internal modules)

```typescript
// Import the quartoAPI instance
import { quartoAPI as quarto } from "../../core/quarto-api.ts";

// Use it
const caps = await quarto.jupyter.capabilities();
await quarto.console.withSpinner({ message: "Working..." }, async () => {
  // do work
});
```

#### External engines

External engines receive the API via their `init()` method:

```typescript
let quarto: QuartoAPI;

export const myEngineDiscovery: ExecutionEngineDiscovery = {
  init: (quartoAPI: QuartoAPI) => {
    quarto = quartoAPI; // Store for later use
  },

  // ... other methods can now use quarto
};
```

#### Removing old imports

When moving functionality to the API, **remove direct imports** from internal modules:

```typescript
// ❌ OLD - direct import
import { withSpinner } from "../../core/console.ts";

// ✅ NEW - use API
import { quartoAPI as quarto } from "../../core/quarto-api.ts";
const result = await quarto.console.withSpinner(...);
```

This ensures external engines and internal code use the same interface.
