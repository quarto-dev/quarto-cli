---@meta

--[[
Inline values are equal in Lua if and only if they are equal in
Haskell.
]]
---@class pandoc.Inline : pandoc.Element

--[[
Applies a Lua filter to the Inline element. Just as for
full-document filters, the order in which elements are traversed
can be controlled by setting the `traverse` field of the filter. Returns a
(deep) copy on which the filter has been applied: the original
element is left untouched.

Note that the filter is applied to the subtree, but not to the
`self` inline element. The rationale is that otherwise the
element could be deleted by the filter, or replaced with multiple
inline elements, which might lead to possibly unexpected results.

Usage:

    -- returns `pandoc.SmallCaps('SPQR)`
    return pandoc.SmallCaps('spqr'):walk {
      Str = function (s) return string.upper(s.text) end,
    }
]]
---@param lua_filter table<string,function> Map of filter functions
---@return pandoc.Inline # Filtered inline element
function pandoc.Inline:walk(lua_filter) end

--[[
List of `Inline` elements, with the same methods as a generic
`List` but with an additional `walk` method.
]]
---@class pandoc.Inlines : pandoc.List

--[[
Create an inlines list 
]]
---@param inlines table Inline elements
---@return pandoc.Inlines
function pandoc.Inlines(inlines) end

