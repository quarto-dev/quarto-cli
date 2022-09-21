---@meta

quarto.json = {}

--[[
Parse the JSON `str` into a Lua value
]]
---@param str string JSON string
---@return any
function quarto.json.decode(str) end

--[[
Encode a Lua value into a JSON string
]]
---@param value any Lua value
---@return string
function quarto.json.encode(value) end

