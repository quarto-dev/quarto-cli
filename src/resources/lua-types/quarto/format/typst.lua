---@meta

quarto.format.typst = {}

--[[
Create a node that represents a typst function call.

When `keep_scaffold` is false, the resulting Div gets a `quarto-scaffold`
class that strips the wrapper. When true or nil (default), a plain Div
is returned.
]]
---@param name string Name of function
---@param params (any|{[1]:string,[2]:any})[] Array of positional values or {key, value} pairs
---@param keep_scaffold? boolean
---@return pandoc.Div
function quarto.format.typst.function_call(name, params, keep_scaffold) end

--[[
Create a node that represents typst content (`[Hello, world]`). Use
this to ensure your output isn't interpreted as typst computations.
]]
---@param content any Content to wrap
---@param blocks_or_inlines? "blocks"|"inlines" Output mode (default: "blocks")
---@return pandoc.Blocks|pandoc.Inlines
function quarto.format.typst.as_typst_content(content, blocks_or_inlines) end

--[[
Convert a Lua table to a Typst dictionary string representation.
Returns nil if the table is empty.
]]
---@param tab table Table to convert
---@return string|nil
function quarto.format.typst.as_typst_dictionary(tab) end

--[[
Format a marginalia shift parameter for Typst output.
Values `"true"`, `"false"`, and `"auto"` are returned unquoted;
other values are wrapped in quotes.
]]
---@param shift string Shift parameter value
---@return string
function quarto.format.typst.format_shift_param(shift) end

---@type table CSS-to-Typst translation utilities (quarto.format.typst.css)
quarto.format.typst.css = {}
