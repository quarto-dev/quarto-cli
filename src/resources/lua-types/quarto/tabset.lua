---@meta

quarto = {}

---@alias quarto.Tabset { level: number, tabs: quarto.Tab[], attr: pandoc.Attr }
--[[
Create a Tabset AST node (represented as a Lua table)
]]
---@param params { level: nil|number, tabs: nil|quarto.Tab[], attr: nil|pandoc.Attr }
---@return quarto.Tabset
function quarto.Tabset(params) end

