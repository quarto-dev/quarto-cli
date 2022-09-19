---@meta

---@alias pandoc.MetaValue pandoc.MetaBool|pandoc.MetaString|pandoc.MetaInlines|pandoc.MetaBlocks|pandoc.MetaList|pandoc.MetaMap
---@alias pandoc.MetaBool boolean
---@alias pandoc.MetaString string|number
---@alias pandoc.MetaInlines pandoc.List
---@alias pandoc.MetaBlocks pandoc.List
---@alias pandoc.MetaList table<number,pandoc.MetaValue>
---@alias pandoc.MetaMap table<string,pandoc.MetaValue>

--[[
Meta information on a document; string-indexed collection of meta values.
Meta values are equal in Lua if and only if they are equal in Haskell.
]]
---@alias pandoc.Meta table<string,pandoc.MetaValue>

---@param meta_table table<string,pandoc.MetaValue> Table containing document meta information
---@return pandoc.Meta # Meta object
function pandoc.Meta(meta_table) end

--[[
Creates a value to be used as a MetaBlocks value in meta
data; creates a copy of the input list via `pandoc.Blocks`,
discarding all non-list keys.
]]
---@param blocks pandoc.List
---@return pandoc.MetaBlocks
function pandoc.MetaBlocks(blocks) end

--[[
Creates a value to be used as a MetaInlines value in meta
data; creates a copy of the input list via `pandoc.Inlines`,
discarding all non-list keys.
]]
---@param inlines pandoc.List
---@return pandoc.MetaInlines
function pandoc.MetaInlines(inlines) end

--[[
Creates a value to be used as a MetaList in meta data;
creates a copy of the input list via `pandoc.List`,
discarding all non-list keys.
]]
---@param meta_values table<number,pandoc.MetaValue>
---@return pandoc.MetaList
function pandoc.MetaList(meta_values) end

--[[
-- Creates a value to be used as a MetaMap in meta data; creates
-- a copy of the input table, keeping only pairs with string
-- keys and discards all other keys.
]]
---@param key_value_map table<string,pandoc.MetaValue>
---@return pandoc.MetaMap
function pandoc.MetaMap(key_value_map) end


--[[
Creates a value to be used as a MetaString in meta data; this
is the identity function for boolean values and exists only
for completeness.
]]
---@param str string|number String value
---@return pandoc.MetaString
function pandoc.MetaString(str) end

--[[
Creates a value to be used as MetaBool in meta data; this is
the identity function for boolean values and exists only for
completeness.
]]
---@param bool boolean Boolean value
---@return pandoc.MetaBool
function pandoc.MetaBool(bool) end

