---
paths:
  - "src/resources/filters/**/*.lua"
---

# Lua Filter Development Conventions

Guidance for developing Lua filters in Quarto's filter system.

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
