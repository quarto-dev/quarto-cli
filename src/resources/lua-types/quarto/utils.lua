---@meta

quarto.utils = {}

--[[
Dump a text representation of the passed `value` to stdout.

Note that you should use `quarto.log.output()` instead of this function.
]]
---@deprecated
---@param value any Value to dump
---@param raw? boolean If true, include private/internal keys in output
function quarto.utils.dump(value) end

--[[
Extended type function that returns Pandoc types with Quarto custom node awareness.

Returns `"CustomBlock"` for Quarto custom block nodes and `"CustomInline"` for
custom inline nodes, otherwise delegates to `pandoc.utils.type()`.
]]
---@param value any Value to check
---@return string
function quarto.utils.type(value) end

quarto.utils.table = {}

--[[
Return `true` if the table is a plain integer-indexed array.
]]
---@param t table Table to check
---@return boolean
function quarto.utils.table.isarray(t) end

--[[
Return `true` if the array-like table contains the given value.
]]
---@param t table Array-like table to search
---@param value any Value to find
---@return boolean
function quarto.utils.table.contains(t, value) end

--[[
Iterator that traverses table keys in sorted order.
]]
---@param t table Table to iterate
---@param f? function Optional comparison function for sorting
---@return function Iterator function
function quarto.utils.table.sortedPairs(t, f) end

--[[
Compute the absolute path to a file that is installed alongside the Lua script.

This is useful for internal resources that your filter needs but should
not be visible to the user.
]]
---@param path string Path of file relative to the Lua script
---@return string
function quarto.utils.resolve_path(path) end

--[[
Resolve a file path relative to the document's working directory.

Unlike `resolve_path()` which resolves relative to the Lua script,
this resolves relative to the document being rendered.
]]
---@param path string File path to resolve
---@return string
function quarto.utils.resolve_path_relative_to_document(path) end

--[[
Converts a string to a list of Pandoc Inlines, processing any Quarto custom
syntax in the string.
]]
---@param s string String of Quarto markdown to be converted
---@return pandoc.Inlines
function quarto.utils.string_to_inlines(s) end

--[[
Converts a string to a list of Pandoc Blocks, processing any Quarto custom
syntax in the string.
]]
---@param s string String of Quarto markdown to be converted
---@return pandoc.Blocks
function quarto.utils.string_to_blocks(s) end

--[[
Coerce the given object into a `pandoc.Inlines` list.

Handles Inline, Inlines, Block, Blocks, List, and table inputs.
More performant than `pandoc.Inlines()` as it avoids full marshal roundtrips.

Note: The input object may be modified destructively.
]]
---@param obj any Object to coerce
---@return pandoc.Inlines
function quarto.utils.as_inlines(obj) end

--[[
Coerce the given object into a `pandoc.Blocks` list.

Handles Block, Blocks, Inline, Inlines, List, Caption, and table inputs.
More performant than `pandoc.Blocks()` as it avoids full marshal roundtrips.

Note: The input object may be modified destructively.
]]
---@param obj any Object to coerce
---@return pandoc.Blocks
function quarto.utils.as_blocks(obj) end

--[[
Return `true` if the given AST node is empty.

A node is considered empty if it's an empty list/table, has empty `content`,
has empty `caption`, or has an empty `text` field.
]]
---@param node any AST node to check
---@return boolean
function quarto.utils.is_empty_node(node) end

--[[
Walk and render extended/custom AST nodes.

Processes Quarto custom AST nodes (like Callout, Tabset, etc.) into their
final Pandoc representation.
]]
---@param node pandoc.Node AST node to render
---@return pandoc.Node
function quarto.utils.render(node) end

--[[
CSS-selector-like AST matcher for Pandoc nodes.

Accepts string path selectors separated by `/` with support for:
- Element type selectors (e.g. `"Header"`, `"Para"`, `"Div"`)
- Child traversal via `/` separator
- `*` wildcard to match any child
- `{Type}` capture syntax to return matched nodes
- `:child` to search direct children
- `:descendant` to search all descendants
- `:nth-child(n)` to match a specific child index

Returns a function that, when called with an AST node, returns the matched
node(s) or `false`/`nil` if no match.
]]
---@param ... string|number|function Selector path components
---@return function Matcher function
function quarto.utils.match(...) end

--[[
Append a Block, Blocks, or Inlines value to an existing Blocks list.

Blocks and Inlines are extended into the list; a single Block is inserted.
]]
---@param blocks pandoc.Blocks Target Blocks list
---@param block pandoc.Block|pandoc.Blocks|pandoc.Inlines Value to append
function quarto.utils.add_to_blocks(blocks, block) end

--[[
Returns a filter that parses book metadata markers during document traversal.

When combined with your filter using `combineFilters()`, this enables access
to book-specific metadata like `bookItemType`, `bookItemNumber`, etc. through
`quarto.doc.file_metadata()`.

This is primarily useful for Typst book extensions that need to handle
parts and appendices differently based on the book structure.
]]
---@return table Pandoc filter table
function quarto.utils.file_metadata_filter() end

--[[
Combines multiple Pandoc filters into a single filter for one traversal.

This is useful when your extension filter needs to run alongside another
filter (like `file_metadata_filter()`) in a single document traversal,
ensuring proper state synchronization.

Example:
```lua
return quarto.utils.combineFilters({
  quarto.utils.file_metadata_filter(),
  my_header_filter
})
```
]]
---@param filters table[] Array of Pandoc filter tables to combine
---@return table Combined Pandoc filter table
function quarto.utils.combineFilters(filters) end
