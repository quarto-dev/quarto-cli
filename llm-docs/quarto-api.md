# Quarto API and @quarto/types

## Scope of this document

This document covers **adding or modifying methods in existing namespaces** of the Quarto API.

**Out of scope:** Creating new namespaces, renaming namespaces, or restructuring the API architecture. These operations require reading `src/core/api/*.ts` in depth and should be planned and executed with a human in the loop.

---

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
2. **Implementation** in `src/core/api/` - used within quarto-cli

### Existing namespaces

The API has these namespaces (each has a corresponding file in `src/core/api/`):

- `system` - Process execution, environment detection, temp files
- `console` - Logging, spinners, user feedback
- `path` - Path manipulation and resource locations
- `format` - Format detection utilities
- `jupyter` - Jupyter notebook operations
- `text` - Text processing utilities
- `mappedString` - Source-mapped string operations
- `markdownRegex` - Markdown parsing with regex
- `crypto` - Cryptographic utilities

### Step-by-step: Adding a method to an existing namespace

Follow these steps when adding a new method to an existing namespace:

#### 1. Add to quarto-types type definitions

In `packages/quarto-types/src/quarto-api.ts`, find the namespace and add your method:

```typescript
system: {
  // ... existing methods

  /**
   * Your method description
   * @param arg - Argument description
   * @returns Return value description
   */
  yourMethod: (arg: ArgType) => ReturnType;
};
```

If your method needs new types, add them to the appropriate file in `packages/quarto-types/src/` (e.g., `system.ts` for system-related types).

#### 2. Test the type definitions

```bash
cd packages/quarto-types
npm run build
```

This will typecheck and bundle. Fix any errors before proceeding.

#### 3. Add to internal types

In `src/core/api/types.ts`, find the namespace interface and add your method:

```typescript
export interface SystemNamespace {
  // ... existing methods
  yourMethod: (arg: ArgType) => ReturnType;
}
```

#### 4. Implement the method

In the namespace's implementation file (e.g., `src/core/api/system.ts`):

1. Import any needed functions at the top
2. Add the method to the returned object

```typescript
import { yourImplementation } from "../your-module.ts";

globalRegistry.register("system", (): SystemNamespace => {
  return {
    // ... existing methods
    yourMethod: yourImplementation,
  };
});
```

#### 5. Verify with typecheck

```bash
package/dist/bin/quarto
```

No output means success.

#### 6. Commit with built artifact

**Always commit the built `dist/index.d.ts` file** along with source changes:

```bash
git add packages/quarto-types/src/quarto-api.ts \
        packages/quarto-types/dist/index.d.ts \
        src/core/api/types.ts \
        src/core/api/system.ts

git commit -m "Add yourMethod to system namespace"
```

### Using the Quarto API in source files

#### Execution engines (preferred)

Execution engines receive the API via their `init()` method. Store it for use throughout the engine:

```typescript
import type { QuartoAPI } from "../../core/api/index.ts";

let quarto: QuartoAPI;

export const myEngineDiscovery: ExecutionEngineDiscovery = {
  init: (quartoAPI: QuartoAPI) => {
    quarto = quartoAPI;
  },

  launch: (context) => {
    return {
      // ... use quarto throughout
      markdownForFile(file) {
        return quarto.mappedString.fromFile(file);
      },
    };
  },
};
```

#### When init() API is not available

For helper modules that don't have access to the API via `init()`, use `getQuartoAPI()`:

```typescript
import { getQuartoAPI } from "../../core/api/index.ts";

function someHelper() {
  const quarto = getQuartoAPI();
  const caps = await quarto.jupyter.capabilities();
}
```

#### Removing old imports

When moving functionality to the API, **remove direct imports** from internal modules:

```typescript
// ❌ OLD - direct import
import { withSpinner } from "../../core/console.ts";

// ✅ NEW - use API via init() or getQuartoAPI()
const quarto = getQuartoAPI();
const result = await quarto.console.withSpinner(...);
```

This ensures external engines and internal code use the same interface.
