---@meta

quarto.format.typst = {}

--[[
Create a node that represents a typst function call.
]]
---@param name string Name of function
---@param params table<string, any> Array of {param, value} pairs
---@param keep_scaffold? boolean If true, the result will be wrapped in a typst block.
---@return pandoc.Div 
function quarto.format.typst.function_call(name, params, keep_scaffold) end

--[[
Create a node that represents typst content (`[Hello, world]`). Use
this to ensure your output isn't interpreted as typst computations.
]]
---@param content any content
---@return pandoc.Blocks
function quarto.format.typst.as_typst_content(content) end