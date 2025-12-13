---@meta

quarto.metadata = {}

--[[
Return the value of a metadata entry in Quarto metadata as a pandoc.MetaValue.
Return nil if the key (or any of its subcomponents) are missing.

This is the Lua equivalent of the {{< meta key >}} shortcode in Quarto documents.
]]
---@param key string metadata key, possibly with nested keys separated by dots
---@return pandoc.MetaValue | nil
function quarto.metadata.get(key) end
