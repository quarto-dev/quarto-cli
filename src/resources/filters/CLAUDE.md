# Lua Filter System

This directory contains Quarto's Lua filter system - a multi-stage document transformation pipeline that processes Pandoc AST through ~212 Lua files.

## Quick Reference

| Task | Location |
|------|----------|
| Add new filter | Edit `main.lua`, add `import()` + filter entry |
| Create custom node | `customnodes/` + `_quarto.ast.add_handler()` |
| Check format | `_quarto.format.isHtmlOutput()`, `.isLatexOutput()`, etc. |
| Logging | `warn()`, `error()`, `info()` from `common/log.lua` |
| Debug dump | `quarto.utils.dump(obj)` |
| Trace filters | `quarto dev-call show-ast-trace document.qmd` |

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

User filters can run between stages via entry points (`pre-ast`, `post-ast`, `pre-quarto`, etc.).

## Custom Node System

Quarto extends Pandoc AST with custom node types (callouts, tabsets, floats, etc.).

**Lifecycle:**
1. **Parse** (quarto-pre): Detect special Div → create custom node
2. **Transform**: Filters manipulate custom nodes
3. **Render** (quarto-post): Convert back to Pandoc AST for output

**Example custom node handler:**
```lua
_quarto.ast.add_handler({
  class_name = "callout",
  ast_name = "Callout",
  kind = "Block",
  parse = function(div) ... end,
  slots = { "title", "content" },
  constructor = function(tbl) ... end
})
```

**Key files:**
- `ast/customnodes.lua` - Core system
- `customnodes/*.lua` - Individual implementations

## Common Patterns

**Format-specific rendering:**
```lua
if _quarto.format.isLatexOutput() then
  return pandoc.RawBlock("latex", "\\begin{...}...")
elseif _quarto.format.isHtmlOutput() then
  return pandoc.Div(...)
end
```

**Walking custom nodes:**
```lua
doc = _quarto.ast.walk(doc, filter)  -- Handles custom nodes
```

**Checking node types:**
```lua
if is_custom_node(node, "Callout") then ... end
if is_regular_node(node, "Div") then ... end  -- NOT custom node
```

**Reading options:**
```lua
local value = option("callout-icon", true)
local engine = param("execution-engine")
```

## Adding a New Filter

1. Choose stage: `quarto-pre/`, `quarto-post/`, etc.
2. Create filter file:
   ```lua
   -- quarto-pre/my-feature.lua
   function my_feature()
     return {
       Div = function(div)
         if div.classes:includes("my-feature") then
           return process(div)
         end
       end
     }
   end
   ```
3. Import in `main.lua`:
   ```lua
   import("./quarto-pre/my-feature.lua")
   ```
4. Add to filter list in `main.lua`:
   ```lua
   { name = "pre-my-feature", filter = my_feature() }
   ```

## Debugging

**Filter tracing (recommended):**
```bash
# Linux/macOS
package/dist/bin/quarto dev-call show-ast-trace document.qmd

# Windows
package/dist/bin/quarto.cmd dev-call show-ast-trace document.qmd
```

**Print debugging:**
```lua
quarto.utils.dump(node)  -- Pretty-print any object
warn("Debug: " .. tostring(value))  -- Appears in console
```

**AST diagram:**
```bash
quarto dev-call make-ast-diagram document.qmd
```

## Common Gotchas

1. **Custom vs regular nodes**: Use `is_regular_node()` to exclude custom nodes
2. **Slot assignment**: Use proxy pattern, don't assign directly to `.content`
3. **Filter returns**: Return `nil` to continue, return value to replace
4. **Lua messages**: `warn()` appears as INFO level on TypeScript side

## Key Files

| File | Purpose |
|------|---------|
| `main.lua` | Filter chain definition (~725 lines) |
| `common/log.lua` | Logging utilities |
| `common/debug.lua` | Debug utilities (`dump`, `tdump`) |
| `common/format.lua` | Format detection |
| `common/options.lua` | Metadata option reading |
| `ast/customnodes.lua` | Custom node system |

## Related Documentation

- **Lua API**: <https://quarto.org/docs/extensions/lua-api.html>
- **Filter tracing**: `dev-docs/lua-filter-trace-viewer.qmd`
- **Rule file**: `.claude/rules/filters/lua-development.md`
