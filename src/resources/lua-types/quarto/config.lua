---@meta

quarto.config = {}

--[[
Return the current Quarto version as a `pandoc.Version` object.

]]
---@return pandoc.Version
function quarto.config.version() end

--[[
Return the full path to quarto binary being used to run the Lua filter.
]]
---@return string
function quarto.config.cli_path() end