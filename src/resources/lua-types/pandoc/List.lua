---@meta

---@class pandoc.List
pandoc.List = {}

--[[
 Create a new List 
]]
---@param table? table # (Optional) `table` to initialize list from
---@return pandoc.List
function pandoc.List(table) end

--[[
 Create a new List 
]]
---@param table? table # (Optional) `table` to initialize list from
---@return pandoc.List
function pandoc.List:new(table) end

--[[
Returns a (shallow) copy of the list. (To get a deep copy of the list, use walk with an empty filter.)
]]
---@return pandoc.List 
function pandoc.List:clone() end

--[[
Adds the given list to the end of this list.
]]
---@param list pandoc.List List to append
---@return pandoc.List
function pandoc.List:extend(list) end

--[[
Returns the value and index of the first occurrence of the given item.
]]
---@param needle any Item to search for
---@param init? integer (Optional) Index at which the search is started
---@return any, integer  # First item equal to the needle, or `nil` if no such item exists.
function pandoc.List:find(needle, init) end


--[[
Returns the value and index of the first element for which the predicate holds true.
]]
---@param pred fun(x: any): boolean # Condition items must satisfy
---@param init? integer (Optional) Index at which the search is started
---@return any|nil,integer|nil # First item for which `pred` succeeds, or `nil` if no such item exists.
function pandoc.List:find_if(pred, init) end


--[[
Returns a new list containing all items satisfying a given condition.
]]
---@param pred fun(x: any): boolean # Condition items must satisfy
---@return pandoc.List
function pandoc.List:filter(pred) end



--[[
Checks if the list has an item equal to the given needle.
]]
---@param needle any Item to search for
---@param init? integer (Optional) Index at which the search is started
---@return boolean  # `true` if a list item is equal to the `needle`, `false` otherwise
function pandoc.List:includes(needle, init) end




--[[
Inserts element at end of list
]]
---@param value any Value to insert into the list
function pandoc.List:insert(value) end


--[[
Inserts element value at position `pos` in list, shifting elements to the next-greater index if necessary.
]]
---@param pos integer Index of the new value
---@param value any Value to insert into the list
function pandoc.List:insert(pos, value) end


--[[
Returns a copy of the current list by applying the given function to all elements.
]]
---@param fn fun(x: any): any # Function which is applied to all list items.
---@return pandoc.List
function pandoc.List:map(fn) end

--[[
Removes the element at position `pos`, returning the value of the removed element.
]]
---@param pos? integer Position of the list value that will be removed; defaults to the index of the last element
---@return any # The removed element
function pandoc.List:remove(pos) end

--[[
Sorts list elements in a given order, in-place. If comp is given, then it must be a function that receives
two list elements and returns true when the first element must come before the second in the final order
(so that, after the sort, i < j implies not comp(list[j],list[i])). If comp is not given, then the standard
Lua operator < is used instead.

Note that the comp function must define a strict partial order over the elements in the list; that is, it
must be asymmetric and transitive. Otherwise, no valid sort may be possible.

The sort algorithm is not stable: elements considered equal by the given order may have their relative
positions changed by the sort.
]]
---@param comp? fun(a, b): boolean 
function pandoc.List:sort(comp) end

--[[
Applies a Lua filter to a list of `Blocks` or `Inlines`. Just as for
full-document filters, the order in which elements are traversed
can be controlled by setting the `traverse` field of the filter;
Returns a (deep) copy on which the filter has been applied: the original
list is left untouched.

Note that this method is only available for lists of blocks and inilines.

Usage:

    -- returns `pandoc.Blocks{pandoc.Para('Salve!')}`
    return pandoc.Blocks{pandoc.Plain('Salve!)}:walk {
      Plain = function (p) return pandoc.Para(p.content) end,
    }
]]
---@param lua_filter table<string,function> Map of filter functions
---@return pandoc.List # Filtered list
function pandoc.List:walk(lua_filter) end


return pandoc.List