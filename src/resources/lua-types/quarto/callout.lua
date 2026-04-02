---@meta

quarto = {}

--[[
Create a Callout AST node, represented as an "opaque pointer" in a RawInline. Also returns the resolved table object

]]
---@param tbl { type: nil|'note'|'warning'|'important'|'caution'|'tip'|'none', appearance: nil|'minimal'|'simple'|'default', icon: nil|boolean|string, collapse: nil|boolean|string, content: nil|pandoc.Blocks|string, title: nil|pandoc.Inlines|pandoc.Inline|string, attr: nil|pandoc.Attr } Callout parameters
---@return pandoc.Div, table
function quarto.Callout(tbl) end
