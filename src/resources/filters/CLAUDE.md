# Lua Filter System

This directory contains Quarto's Lua filter system - a multi-stage document transformation pipeline that processes Pandoc AST through ~212 Lua files.

**For coding conventions:** See `.claude/rules/filters/lua-development.md`

## Directory Structure

```
filters/
├── main.lua              # Entry point - filter chain definition
├── mainstateinit.lua     # Global state initialization
├── ast/                  # Custom AST infrastructure
├── common/               # Shared utilities (~35 files)
├── modules/              # Reusable modules (require())
├── customnodes/          # Custom node implementations
├── quarto-init/          # Initialization stage
├── normalize/            # Normalization stage
├── quarto-pre/           # Pre-processing (shortcodes, tables, etc.)
├── crossref/             # Cross-reference system
├── layout/               # Layout processing
├── quarto-post/          # Post-processing (format-specific)
└── quarto-finalize/      # Final cleanup
```

## Filter Execution Pipeline

```
1. INIT (quarto-init/)
   ↓
2. NORMALIZE (normalize/)
   ↓
3. PRE (quarto-pre/) - shortcodes, tables, code annotations
   ↓
4. CROSSREF (crossref/) - cross-references
   ↓
5. LAYOUT (layout/) - panels, columns
   ↓
6. POST (quarto-post/) - format-specific rendering
   ↓
7. FINALIZE (quarto-finalize/) - cleanup, dependencies
```

User filters run between stages via entry points (`pre-ast`, `post-ast`, `pre-quarto`, etc.).

## Key Files

| File | Purpose |
|------|---------|
| `main.lua` | Filter chain definition (~725 lines) |
| `mainstateinit.lua` | Global state initialization |
| `ast/customnodes.lua` | Custom node system |
| `common/log.lua` | Logging utilities |
| `common/debug.lua` | Debug utilities (`dump`, `tdump`) |
| `common/format.lua` | Format detection |
| `common/options.lua` | Metadata option reading |

## Debugging

**Filter tracing (recommended):**
```bash
# Linux/macOS
package/dist/bin/quarto dev-call show-ast-trace document.qmd

# Windows
package/dist/bin/quarto.cmd dev-call show-ast-trace document.qmd
```

**AST diagram:**
```bash
quarto dev-call make-ast-diagram document.qmd
```

## Related Documentation

- **Coding conventions**: `.claude/rules/filters/lua-development.md`
- **Lua API**: <https://quarto.org/docs/extensions/lua-api.html>
- **Filter tracing**: `dev-docs/lua-filter-trace-viewer.qmd`
