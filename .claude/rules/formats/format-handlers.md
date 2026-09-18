---
paths:
  - "src/format/**/*"
---

# Format System

Guidance for working with the Quarto format system.

## Architecture Overview

```
Format Resolution Flow:
┌──────────────────────────────────────────────────┐
│ defaultWriterFormat(formatString)  [formats.ts]  │
│                                                  │
│ 1. Check registered handlers (writerFormatHandlers)
│ 2. Fall back to built-in switch statement        │
│ 3. Apply format variants (mergeFormatVariant)    │
└──────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `formats.ts` | Central `defaultWriterFormat()` resolver |
| `format-handlers.ts` | Handler registration API |
| `formats-shared.ts` | Factory functions (`createFormat`, `createHtmlFormat`) |
| `imports.ts` | Side-effect imports for format registration |

## Format Handler Pattern

Modern formats use registration to avoid circular dependencies:

```typescript
// src/format/<name>/format-<name>.ts
import { registerWriterFormatHandler } from "../format-handlers.ts";

function myFormat(): Format {
  return createFormat("My Format", "html", {
    pandoc: { to: "html" },
    render: { /* ... */ },
    // ...
  });
}

// Register at module scope (runs on import)
registerWriterFormatHandler((format) => {
  if (format === "myformat") {
    return {
      format: myFormat(),
      pandocTo: "html",  // Optional: override Pandoc writer
    };
  }
});
```

Then add to `imports.ts`:
```typescript
import "./myformat/format-myformat.ts";
```

## Format Structure

```typescript
interface Format {
  identifier: FormatIdentifier;   // Display name, base/target format
  render: FormatRender;           // Rendering options (keep-tex, etc.)
  execute: FormatExecute;         // Execution (fig-width, echo, cache)
  pandoc: FormatPandoc;           // Pandoc args (to, from, template)
  language: FormatLanguage;       // Localized strings
  metadata: Metadata;             // Document metadata

  // Optional hooks
  resolveFormat?: (format: Format) => void;
  formatExtras?: (...) => Promise<FormatExtras>;
  extensions?: { book?: BookExtension };
}
```

## Factory Functions

**Base format:**
```typescript
import { createFormat } from "../formats-shared.ts";

const format = createFormat(
  "My Format",     // Display name
  "html",          // File extension
  baseFormat1,     // Formats to merge (in order)
  baseFormat2,
);
```

**HTML-based:**
```typescript
import { createHtmlFormat, htmlFormat } from "../formats-shared.ts";

const format = createHtmlFormat("My HTML", 7, 5);  // figwidth, figheight
```

**Extend existing:**
```typescript
import { mergeConfigs } from "../../core/config.ts";

const format = mergeConfigs(
  htmlFormat(7, 5),  // Base format
  {
    render: { echo: false },
    execute: { warning: false },
  },
);
```

## FormatExtras Hook

The `formatExtras()` hook adds format-specific processing:

```typescript
formatExtras: async (
  input: string,
  markdown: string,
  flags: RenderFlags,
  format: Format,
  libDir: string,
  services: RenderServices,
  offset?: string,
  project?: ProjectContext,
  quiet?: boolean,
) => {
  return {
    pandoc: { /* additional pandoc args */ },
    html: {
      dependencies: [/* scripts, stylesheets */],
      sass: [/* Sass bundles */],
    },
    postprocessors: [/* DOM manipulation functions */],
    // ...
  };
},
```

## Adding a New Format

**Step 1:** Create format file

```typescript
// src/format/myformat/format-myformat.ts
import { createFormat } from "../formats-shared.ts";
import { registerWriterFormatHandler } from "../format-handlers.ts";
import { mergeConfigs } from "../../core/config.ts";

function myFormat(): Format {
  return mergeConfigs(
    createFormat("My Format", "html"),
    {
      pandoc: {
        to: "html",
        // format-specific pandoc options
      },
      execute: {
        echo: false,  // example: hide code by default
      },
    },
  );
}

registerWriterFormatHandler((format) => {
  if (format === "myformat") {
    return {
      format: myFormat(),
      pandocTo: "html",
    };
  }
});
```

**Step 2:** Add to imports

```typescript
// src/format/imports.ts
import "./myformat/format-myformat.ts";
```

**Step 3:** Test

```yaml
# test.qmd
---
format: myformat
---
Test content
```

## Directory Structure

```
src/format/
├── format-handlers.ts      # Registration API
├── formats.ts              # Central resolver
├── formats-shared.ts       # Factory functions
├── imports.ts              # Initialization
├── html/                   # HTML + variants
├── reveal/                 # Reveal.js
├── dashboard/              # Dashboard
├── pdf/                    # PDF, Beamer
├── typst/                  # Typst
├── docx/                   # DOCX
└── ...
```

## Key Concepts

1. **Registration order** - Handlers checked before hardcoded formats
2. **Format composition** - Use `mergeConfigs()` to layer formats
3. **Pandoc writer override** - Handler can map format → different pandoc writer
4. **Lazy initialization** - Side-effect imports prevent circular deps
5. **formatExtras** - Pre-Pandoc setup (dependencies, sass)
6. **postprocessors** - Post-Pandoc file manipulation
