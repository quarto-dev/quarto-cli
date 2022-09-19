---@meta

--[[
List of `Inline` elements, with the same methods as a generic
`List`, but also supporting a `walk` method.
]]
---@class pandoc.Inlines : pandoc.List
pandoc.Inlines = {}


--[[
Create an inlines list 
]]
---@param inlines any Inline elements
---@return pandoc.List
function pandoc.Inlines(inlines) end

