---@meta

quarto = {}

---@alias quarto.Tabset { level: number, tabs: quarto.Tab[], attr: pandoc.Attr }
--[[
Create a Tabset AST node, represented as an "opaque pointer" in a RawInline. Also returns the resolved table object
]]
---@param params { level: nil|number, tabs: nil|quarto.Tab[], attr: nil|pandoc.Attr }
---@return pandoc.RawInline, quarto.Tabset
function quarto.Tabset(params) end

