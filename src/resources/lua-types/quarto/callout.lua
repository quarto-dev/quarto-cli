---@meta

quarto = {}

--[[
Create a Callout AST node (represented as a Lua table)
]]
---@param tbl { appearance: nil|'minimal'|'simple', caption: nil|pandoc.Inlines|string, collapse: nil|boolean, content: nil|pandoc.Blocks|string, icon:nil|string, type: nil|'note'|'warning'|'important'|'caution'|'tip'|'none' } parameters
---@return table
function quarto.Callout(tbl) end
