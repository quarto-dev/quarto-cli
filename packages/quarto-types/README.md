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

### ExecutionEngine

Interface for implementing a Quarto execution engine, responsible for executing code cells within documents.

### EngineProjectContext

Restricted version of Quarto's ProjectContext that only exposes functionality needed by execution engines.

## License

MIT