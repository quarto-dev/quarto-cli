---
paths:
  - "src/command/render/**/*"
  - "src/render/**/*"
---

# Render Pipeline

Guidance for working with the Quarto render system.

## Render Flow Overview

```
CLI (cmd.ts)
    ↓
render() (render-shared.ts)
    ↓
┌─────────────────────────────────────────────────┐
│ Decision: What type of render?                  │
│                                                 │
│ 1. Project file exists + file in project        │
│    → renderProject()                            │
│                                                 │
│ 2. --output-dir without project file            │
│    → Synthetic project → renderProject()        │
│                                                 │
│ 3. Single file                                  │
│    → singleFileProjectContext() → renderFiles() │
└─────────────────────────────────────────────────┘
    ↓
Per-file pipeline: Execute → Pandoc → Postprocess
```

## Key Files and Responsibilities

| File | Purpose |
|------|---------|
| `cmd.ts` | CLI command handler, argument parsing |
| `render-shared.ts` | Top-level orchestration, render type decision |
| `render-contexts.ts` | Format resolution, metadata merging |
| `render-files.ts` | Per-file render pipeline, freezer logic |
| `project.ts` | Project-level orchestration, output management |
| `render.ts` | Core `renderPandoc()`, postprocessors |
| `types.ts` | Type definitions (`RenderOptions`, `RenderContext`) |

## Synthetic Project Context Pattern

**Critical non-obvious behavior** for `--output-dir` without a project file:

When a user runs:
```bash
quarto render file.qmd --output-dir output/
```

And no `_quarto.yml` exists, Quarto:

1. Creates a temporary `.quarto` directory
2. Uses full `renderProject()` path (NOT `singleFileProjectContext()`)
3. Sets `forceClean` flag to signal cleanup needed
4. After rendering: closes file handles, removes `.quarto`

**Key locations:**
- Creation: `render-shared.ts:52-60`
- Cleanup: `project.ts:889-907`
- Flag: `types.ts:38`

**Why this matters:**
- Prevents `.quarto` debris in non-project directories (#9745)
- Windows file locking requires careful cleanup ordering (#13625)

```typescript
// render-shared.ts - Decision logic
let context = await projectContext(path, nbContext, options);

if (!context && options.flags?.outputDir) {
  // Create synthetic project for --output-dir
  context = await projectContextForDirectory(path, nbContext, options);
  options.forceClean = options.flags.clean !== false;
}

if (context?.config && isProjectInputFile(path, context)) {
  return renderProject(context, options, [path]);
} else {
  context = await singleFileProjectContext(path, nbContext, options);
  return renderFiles([{ path }], options, ...);
}
```

## Format Resolution

Metadata merges in this order (later overrides earlier):

1. **Project metadata** (`_quarto.yml`)
2. **Directory metadata** (`_metadata.yml`)
3. **File metadata** (YAML frontmatter)
4. **Extension formats** (custom extensions)
5. **Default writer format** (built-in defaults)

Implemented in `render-contexts.ts`.

## Execute → Pandoc → Postprocess

**Phase 1: Execute** (`render-files.ts`)
- Check freezer for cached results
- Run execution engine (Jupyter, Knitr, etc.)
- Handle language cells
- Produce markdown + metadata

**Phase 2: Pandoc** (`render.ts`)
- Merge includes from execute result
- Run `runPandoc()` with filters
- Generate output file

**Phase 3: Postprocess** (`render.ts`)
- Engine postprocess
- HTML postprocessors (DOM manipulation)
- Generic postprocessors
- Recipe completion (LaTeX → PDF)
- Self-contained output
- Cleanup

## Cleanup Patterns

**Normal project:**
```typescript
// Controlled by --clean flag
if (options.clean && renderAll) {
  cleanOutputDir(outputDir);
}
```

**Synthetic project (forceClean):**
```typescript
// project.ts - Must close handles before removing files
context.cleanup();  // Close file handles
safeRemoveSync(join(projDir, kQuartoScratch));  // Remove .quarto
```

**Critical for Windows:** Close handles before removing files to avoid "file in use" errors.

## RenderContext Structure

```typescript
interface RenderContext {
  target: ExecutionTarget;      // Input file metadata
  options: RenderOptions;       // Flags, services, pandocArgs
  engine: ExecutionEngineInstance; // Jupyter, Knitr, etc.
  format: Format;               // Resolved format config
  libDir: string;               // Library directory path
  project: ProjectContext;      // Project context (may be synthetic)
  active: boolean;              // Is this format being rendered?
}
```

## Important Flags

| Flag | Purpose |
|------|---------|
| `--output-dir` | Output directory (triggers synthetic project if no project file) |
| `--to` | Target format(s) |
| `--execute` / `--no-execute` | Control code execution |
| `--clean` / `--no-clean` | Control output cleanup |
| `forceClean` (internal) | Signals synthetic project cleanup |

## Development Considerations

When modifying render code:

1. **Consider both paths** - Project render vs single-file render
2. **Synthetic cleanup** - `--output-dir` without project needs cleanup
3. **Windows file locking** - Close handles before removing files
4. **Format resolution** - Multi-level merge is complex
5. **Project types** - Book/website/manuscript customize behavior

## Testing

- Smoke tests: `tests/smoke/render/`
- Output-dir tests: `tests/smoke/render/render-output-dir.test.ts`
- Document tests: `tests/docs/smoke-all/` with `_quarto` metadata
