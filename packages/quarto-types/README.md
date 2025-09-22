# @quarto/types

TypeScript type definitions for developing Quarto execution engines.

## Installation

```bash
npm install @quarto/types
```

## Usage

This package provides TypeScript type definitions for implementing custom execution engines for Quarto.

```typescript
import { ExecutionEngine, EngineProjectContext } from '@quarto/types';

export const customEngine: ExecutionEngine = {
  name: 'custom',
  defaultExt: '.qmd',

  // Implement required methods...

  target: (
    file: string,
    quiet: boolean | undefined,
    markdown: MappedString | undefined,
    project: EngineProjectContext, // Using the restricted context interface
  ) => {
    // Implementation...
  }
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

### Simplified to `Record<string, unknown>`

- **`Format.render`**: The full internal type is `FormatRender` with 100+ lines of specific rendering options including brand configuration and CSS handling. See [src/config/types.ts](https://github.com/quarto-dev/quarto-cli/blob/main/src/config/types.ts#L463-L525).

- **`Format.execute`**: The full internal type is `FormatExecute` with specific execution options. See [src/config/types.ts](https://github.com/quarto-dev/quarto-cli/blob/main/src/config/types.ts#L527-L561).

When accessing properties from these records, use type assertions as needed:

```typescript
const figFormat = options.format.execute["fig-format"] as string | undefined;
const keepHidden = options.format.render?.["keep-hidden"] as boolean | undefined;
```

## License

MIT