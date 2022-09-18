---@meta

--[[
Block values are equal in Lua if and only if they are equal in
Haskell.
]]
---@class pandoc.Block : pandoc.Element

--[[
Applies a Lua filter to the block element. Just as for
full-document filters, the order in which elements are traversed
can be controlled by setting the `traverse` field of the filter. Returns a
(deep) copy on which the filter has been applied: the original
element is left untouched.

Note that the filter is applied to the subtree, but not to the
`self` block element. The rationale is that otherwise the element
could be deleted by the filter, or replaced with multiple block
elements, which might lead to possibly unexpected results.

Usage:

    -- returns `pandoc.Para{pandoc.Str 'Bye'}`
    return pandoc.Para('Hi'):walk {
      Str = function (_) return 'Bye' end,
    }
]]
---@param lua_filter table<string,function> Map of filter functions
---@return pandoc.Block # Filtered block
function pandoc.Block:walk(lua_filter) end


--[[
List of `Block` elements, with the same methods as a generic
`List`, but also supporting a `walk` method.
]]
---@class pandoc.Blocks : pandoc.List

--[[
Create a blocks list 
]]
---@param blocks table of Block elements
---@return pandoc.Blocks 
function pandoc.Blocks(blocks) end


