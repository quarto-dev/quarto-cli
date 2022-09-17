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
---@return any # First item equal to the needle, or `nil` if no such item exists.
function pandoc.List:find(needle, init) end


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
Returns a new list containing all items satisfying a given condition.
]]
---@param pred fun(x: any): boolean # Condition itemms must satisfy
---@return pandoc.List
function pandoc.List:filter(pred) end

--[[
Returns a copy of the current list by applying the given function to all elements.
]]
---@param fn fun(x: any): any # Function which is applied to all list items.
---@return pandoc.List
function pandoc.List:map(fn) end
