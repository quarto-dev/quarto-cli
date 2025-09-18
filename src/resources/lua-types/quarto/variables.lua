---@meta

quarto.variables = {}

--[[
Return the value of a variable in _variables.yml as a string, or nil if name is missing.

This is the Lua equivalent of the {{< var name >}} shortcode in Quarto documents.
]]
---@param name string name of variable
---@return string | nil
function quarto.variables.get(name) end
