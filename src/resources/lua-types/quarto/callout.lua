---@meta

quarto = {}

--[[
Create a Callout AST node. Returns the Div scaffold and the resolved data table.

]]
---@param tbl { type: nil|'note'|'warning'|'important'|'caution'|'tip'|'none', appearance: nil|'minimal'|'simple'|'default', icon: nil|boolean|string, collapse: nil|boolean|string, content: nil|pandoc.Blocks|string, title: nil|pandoc.Inlines|pandoc.Inline|string, attr: nil|pandoc.Attr } Callout parameters
---@return pandoc.Div, table
function quarto.Callout(tbl) end
