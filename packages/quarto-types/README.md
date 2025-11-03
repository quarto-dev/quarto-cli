# @quarto/types

TypeScript type definitions for developing Quarto execution engines.

## Installation

The goal in a couple of releases is for you to be able to do

```bash
npm install @quarto/types
```

But this package is not published yet, because the interfaces are still in flux.

Instead, build the package and copy dist/index.d.ts to types/quarto-types.d.ts in your engine repo.

```bash
npm run build
```

## Usage

This package provides TypeScript type definitions for implementing custom execution engines for Quarto.

```typescript
import { ExecutionEngine, EngineProjectContext } from "@quarto/types";

export const customEngine: ExecutionEngine = {
  name: "custom",
  defaultExt: ".qmd",

  // Implement required methods...

  target: (
    file: string,
    quiet: boolean | undefined,
    markdown: MappedString | undefined,
    project: EngineProjectContext // Using the restricted context interface
  ) => {
    // Implementation...
  },
};
```

## Core Interfaces

### ExecutionEngineDiscovery

Interface for implementing a Quarto execution engine discovery, responsible for determining which engine should handle a file and launching engine instances.

### ExecutionEngineInstance

Interface for a launched execution engine that can execute documents within a project context.

### EngineProjectContext

Restricted version of Quarto's ProjectContext that only exposes functionality needed by execution engines.

## Type Simplifications

This package is designed to be a standalone, lightweight type library for external engine development. To maintain this independence, some internal Quarto types are intentionally simplified:

### Simplified types with omitted fields

- **`RenderOptions`**: The internal Quarto version includes a `services: RenderServices` field, which provides access to temp file context, extension context, and notebook context. This field has been omitted as it requires pulling in large portions of Quarto's internal type system. All other fields are included. See [src/command/render/types.ts](https://github.com/quarto-dev/quarto-cli/blob/main/src/command/render/types.ts#L29-L42) for the full type.

### Simplified to `Record<string, unknown>` or index signatures

- **`Format.render`**: The full internal type is `FormatRender` with 100+ lines of specific rendering options including brand configuration and CSS handling. See [src/config/types.ts](https://github.com/quarto-dev/quarto-cli/blob/main/src/config/types.ts#L463-L525).

- **`Format.execute`**: The full internal type is `FormatExecute` with specific execution options. See [src/config/types.ts](https://github.com/quarto-dev/quarto-cli/blob/main/src/config/types.ts#L527-L561).

- **`Format.pandoc`**: The full internal type is `FormatPandoc` with 80+ lines of pandoc-specific options. Simplified to `{ to?: string; [key: string]: unknown }` preserving only the most commonly accessed `to` property. See [src/config/types.ts](https://github.com/quarto-dev/quarto-cli/blob/main/src/config/types.ts#L563-L646).

When accessing properties from these records, use type assertions as needed:

```typescript
const figFormat = options.format.execute["fig-format"] as string | undefined;
const keepHidden = options.format.render?.["keep-hidden"] as
  | boolean
  | undefined;
const writer = options.format.pandoc.to; // Type-safe access to 'to'
const standalone = options.format.pandoc["standalone"] as boolean | undefined;
```

### Omitted optional functions

The full internal `Format` interface includes several optional functions that are used internally by Quarto but are not needed by external engines:

- **`mergeAdditionalFormats`**: Internal format merging logic
- **`resolveFormat`**: Format resolution and normalization
- **`formatExtras`**: Compute format-specific extras (requires `RenderServices` and `ProjectContext`)
- **`formatPreviewFile`**: Preview file name transformation
- **`extensions`**: Format-specific extension configuration

These functions require deep integration with Quarto's internal systems and are not exposed to external engines. See [src/config/types.ts](https://github.com/quarto-dev/quarto-cli/blob/main/src/config/types.ts#L420-L456) for the full `Format` interface.

## License

MIT
