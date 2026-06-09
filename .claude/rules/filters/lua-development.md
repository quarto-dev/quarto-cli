---
paths:
  - "src/resources/filters/**/*.lua"
  - "src/resources/pandoc/datadir/*.lua"
---

# Lua Filter Development Conventions

Guidance for developing Lua filters in Quarto's filter system.

## The qmd Custom Reader Is a Special Case

`src/resources/pandoc/datadir/readqmd.lua` (and `filters/qmd-reader.lua`) is the custom
Pandoc reader, not a filter. It runs **before** parsing, in a **separate Lua context**
from the filter chain — filter globals (e.g. `crossref.categories`) do not exist there,
and it communicates with filters via document metadata and `param(...)`. The conventions
below target the filter pipeline; the reader follows its own patterns (raw-text
escape-then-restore). See
[llm-docs/qmd-reader-architecture.md](../../../llm-docs/qmd-reader-architecture.md)
before changing reader-stage code.

## Module Loading

### Use `import()` for Filter Files

```lua
-- ✅ Correct - import from main.lua
import("./quarto-pre/shortcodes.lua")

-- ❌ Wrong - require is for modules only
require("./quarto-pre/shortcodes")
```

### Use `require()` for Modules

```lua
-- ✅ Correct - modules from modules/
local patterns = require("modules/patterns")
local md = require("modules/md")

-- ❌ Wrong - using import for modules
import("./modules/patterns.lua")
```

## Custom Node Patterns

### Walking Custom Nodes

Always use `_quarto.ast.walk()` to properly handle custom nodes:

```lua
-- ✅ Correct - handles custom nodes
doc = _quarto.ast.walk(doc, {
  Callout = function(callout)
    -- Process callout
  end
})

-- ❌ Wrong - misses custom nodes
pandoc.walk_block(div, filter)
```

### Checking Node Types

```lua
-- Check if custom node of specific type
if is_custom_node(node, "Callout") then
  -- Handle callout custom node
end

-- Check if regular Pandoc node (NOT custom node)
if is_regular_node(node, "Div") then
  -- Handle regular Div
end

-- Check custom node by presence of is_custom_node flag
if node.is_custom_node then
  -- It's some custom node type
end
```

### Slot Assignment

Use the proxy pattern for slot modification:

```lua
-- ✅ Correct - proxy pattern
local new_callout = callout:clone()
new_callout.content = modified_content
return new_callout

-- ❌ Wrong - direct assignment may not work
callout.content = modified_content
return callout
```

## Format Detection

Use `_quarto.format` for format checks:

```lua
-- HTML output (includes HTML-based formats)
if _quarto.format.isHtmlOutput() then ... end

-- LaTeX/PDF output
if _quarto.format.isLatexOutput() then ... end

-- Typst output
if _quarto.format.isTypstOutput() then ... end

-- Word/DOCX output
if _quarto.format.isDocxOutput() then ... end

-- Reveal.js slides
if _quarto.format.isRevealJsOutput() then ... end

-- Dashboard format
if _quarto.format.isDashboardOutput() then ... end
```

### Gate format checks at execution time, not construction time

`main.lua` builds its filter tables by calling the constructor (`filter = my_filter()`) at load time, **before** the output format is resolved. A format gate placed at the top of the constructor (`if not _quarto.format.isLatexOutput() then return {} end`) therefore evaluates too early, returns an empty filter, and the filter silently never runs for any document. Put the `_quarto.format.*` check **inside** the returned element function (`Meta`, `Div`, ...) so it runs when the format is known. Reference: `quarto-pre/font.lua`.

## Metadata Values

Pandoc Lua metadata values are **not** tagged with a `.t` field (`val.t` is `nil`), so `val.t == "MetaList"` never matches. Detect the shape with `quarto.utils.type(val)` — the in-tree, custom-node-aware superset of `pandoc.utils.type` — which returns `"List"` for a YAML list (iterate with `ipairs`), `"string"` for a plain scalar, and `"Inlines"` for an inline-formatted scalar. Rebuild as a `pandoc.MetaList` of `pandoc.MetaString`; `pandoc.utils.stringify` flattens any scalar to text. Reference: `quarto-post/email.lua` (meta-list iteration).

## Options and Parameters

```lua
-- Read metadata option with default
local show_icon = option("callout-icon", true)

-- Read execution parameter
local engine = param("execution-engine")

-- Read option with nil fallback
local custom = option("my-option")
if custom ~= nil then
  -- Option was set
end
```

## Logging

Use logging functions from `common/log.lua`:

```lua
-- Debug info (verbose)
info("Processing element: " .. el.t)

-- Warnings (appear as INFO on TypeScript side)
warn("Deprecated feature used")

-- Errors
error("Invalid configuration")

-- Conditional debug output
if quarto.log.debug then
  quarto.utils.dump(node)
end
```

## External Command Execution

Use `pandoc.pipe()` instead of `io.popen()` for calling external programs:

```lua
-- ✅ Correct - pandoc.pipe passes args as array, no shell interpretation
local ok, result = pcall(pandoc.pipe, command, {"arg1", "arg2"}, "")
if not ok then
  quarto.log.error("Command failed: " .. tostring(result))
end

-- ❌ Wrong - io.popen uses shell, breaks on paths with spaces
local handle = io.popen(command .. " arg1 arg2", "r")
```

`io.popen()` passes a string to the shell, which breaks when paths contain spaces (e.g., `C:\Program Files\...`). `pandoc.pipe()` calls the executable directly with arguments as an array — no shell, no quoting issues.

Reference: `quarto-pre/shiny.lua`, `quarto-post/pdf-images.lua`

## Filter Return Values

```lua
function my_filter()
  return {
    Div = function(div)
      -- Return nil to continue (no change)
      if not should_process(div) then
        return nil
      end

      -- Return new element to replace
      return pandoc.Div(modified_content)

      -- Return empty list to remove element
      -- return {}
    end
  }
end
```

## Common Utilities

### String Operations

```lua
-- String matching
if string.match(text, "pattern") then ... end

-- String substitution
local result = string.gsub(text, "old", "new")

-- Check class presence
if div.classes:includes("callout") then ... end

-- Check attribute
local value = div.attributes["data-foo"]
```

### Pandoc Helpers

```lua
-- Create elements
local div = pandoc.Div(content, pandoc.Attr(id, classes, attributes))
local span = pandoc.Span(inlines)
local para = pandoc.Para(inlines)

-- Raw output
local raw = pandoc.RawBlock("html", "<div>...</div>")
local raw = pandoc.RawInline("latex", "\\textbf{}")

-- Stringify content
local text = pandoc.utils.stringify(inlines)
```

## Debugging

```lua
-- Pretty-print any object
quarto.utils.dump(node)

-- Type checking
print("Type: " .. type(obj))
print("Pandoc type: " .. (obj.t or "none"))

-- Trace execution
warn("Reached checkpoint: " .. checkpoint_name)
```

## Filter Chain Integration

When adding filters to `main.lua`:

```lua
-- Each filter gets a name and filter function
{ name = "pre-my-feature", filter = my_feature() }

-- Filter order matters - check dependencies
-- Filters in same stage run in order defined
```

A filter entry can carry `flags = { "has_x" }`; `ast/runemulation.lua` skips the entire filter pass when none of the listed flags are set. Compute the flag in `normalize/flags.lua`'s `compute_flags` (its second returned table holds a `Meta` handler for metadata-derived flags). Use this to skip a whole tree traversal for documents that don't need the filter, rather than relying on an early-return inside the function. Examples: `has_notes`, `has_hidden`, `has_font_fallback`.

## API Reference

Consult `src/resources/lua-types/` for available methods, properties, and function signatures:

- `lua-types/pandoc/` - Pandoc Lua API (blocks, inlines, List, utils, etc.)
- `lua-types/quarto/` - Quarto Lua API (format detection, custom nodes, etc.)

These type definition files document the complete API surface.

## Key Conventions Summary

1. **Use `import()` for filters** - `require()` for modules only
2. **Use `_quarto.ast.walk()`** - Not `pandoc.walk_*` for custom nodes
3. **Check node types carefully** - `is_custom_node()` vs `is_regular_node()`
4. **Use proxy pattern** - For modifying custom node slots
5. **Use `_quarto.format`** - For format detection
6. **Return `nil` to continue** - Return value replaces element
7. **`warn()` = INFO level** - On TypeScript side
8. **Gate format inside element fns** - Constructor runs before format is resolved
9. **Detect meta shape with `quarto.utils.type`** - Meta values have no `.t` tag
10. **Gate expensive filters with `flags`** - Skips the whole pass when unneeded
