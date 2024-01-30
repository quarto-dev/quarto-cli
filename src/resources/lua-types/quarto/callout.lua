---@meta

quarto = {}

--[[
Create a Callout AST node, represented as an "opaque pointer" in a RawInline. Also returns the resolved table object

]]
---@param tbl { appearance: nil|'minimal'|'simple', title: nil|pandoc.Inlines|string, collapse: nil|boolean, content: nil|pandoc.Blocks|string, icon:nil|boolean, type: nil|'note'|'warning'|'important'|'caution'|'tip'|'none' } parameters
---@return pandoc.RawInline, table
function quarto.Callout(tbl) end
