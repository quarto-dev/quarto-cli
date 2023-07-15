---@meta

quarto.utils = {}

--[[
Dump a text representation of the passed `value` to stdout.

Note that you should use `quarto.log.output()` instead of this function.
]]
---@deprecated
---@param value any Value to dump
function quarto.utils.dump(value) end

--[[
Compute the absolute path to a file that is installed alongside the Lua script. 

This is useful for internal resources that your filter needs but should 
not be visible to the user.
]]
---@param path string Path of file relative to the Lua script
---@return string
function quarto.utils.resolve_path(path) end

--[[
Converts a string to a list of Pandoc Inlines, processing any Quarto custom
syntax in the string.
]]
---@param path string String to be converted
---@param sep pandoc.Inline|nil separator to be used between parsed blocks (default is pandoc.LineBreak)
---@return pandoc.Inlines
function quarto.utils.string_to_inlines(path, sep) end

--[[
Converts a string to a list of Pandoc Blocks, processing any Quarto custom
syntax in the string.
]]
---@param path string String to be converted
---@return pandoc.Blocks
function quarto.utils.string_to_blocks(path) end
