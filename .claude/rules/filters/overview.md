---
paths:
  - "src/resources/filters/**"
---

# Lua Filter System

Quarto's Lua filter system is a multi-stage document transformation pipeline that processes Pandoc AST through ~212 Lua files.

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

This pipeline runs **after** Pandoc has parsed the document into an AST. The stage that
turns raw `.qmd` text into that AST — Quarto's custom Lua reader, which also does
pre-parse raw-text transforms (shortcode encoding, fenced-code escaping) — is separate
and documented in [llm-docs/qmd-reader-architecture.md](../../../llm-docs/qmd-reader-architecture.md).
Reach for it when a Pandoc *parsing* behavior must change before any filter can run.

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

Visualize filter transformations with the `dev-call` tools `show-ast-trace` (interactive trace viewer) and `make-ast-diagram` (static AST diagram) — see `.claude/rules/dev-tools/dev-call-commands.md` for both.

## Related Documentation

- **Coding conventions**: `.claude/rules/filters/lua-development.md`
- **qmd custom reader (pre-parse stage)**: [llm-docs/qmd-reader-architecture.md](../../../llm-docs/qmd-reader-architecture.md)
- **Lua API**: <https://quarto.org/docs/extensions/lua-api.html>
- **Filter tracing**: `dev-docs/lua-filter-trace-viewer.qmd`
