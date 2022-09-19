---@meta


--[[
List of `Block` elements, with the same methods as a generic
`List`, but also supporting a `walk` method.
]]
---@class pandoc.Blocks : pandoc.List
pandoc.Blocks = {}

--[[
Create a blocks list 
]]
---@param blocks any Block or list of blocks
---@return pandoc.List 
function pandoc.Blocks(blocks) end




--======================== BlockQuote ========================

--[[
A block quote element
]]
---@class pandoc.BlockQuote 
---@field content pandoc.List
---@field t "BlockQuote"
---@field tag "BlockQuote"
pandoc.BlockQuote = {}

--[[
Creates a block quote element
]]
---@param content pandoc.List
---@return pandoc.BlockQuote
function pandoc.BlockQuote(content) end

--[[
Make a clone
]]
---@return pandoc.BlockQuote
function pandoc.BlockQuote:clone() end

--[[
Apply a Lua filter
]]
---@param lua_filter table<string,function> Map of filter functions
---@return pandoc.BlockQuote 
function pandoc.BlockQuote:walk(lua_filter) end

--======================== BulletList ========================

--[[
A bullet list 
]]
---@class pandoc.BulletList 
---@field content pandoc.List
---@field t "BulletList"
---@field tag "BulletList"
pandoc.BulletList = {}

--[[
Creates a bullet list element
]]
---@param content pandoc.List
---@return pandoc.BulletList
function pandoc.BulletList(content) end

--[[
Make a clone
]]
---@return pandoc.BulletList
function pandoc.BulletList:clone() end

--[[
Apply a Lua filter
]]
---@param lua_filter table<string,function> Map of filter functions
---@return pandoc.BulletList 
function pandoc.BulletList:walk(lua_filter) end

--======================== CodeBlock ========================


--[[
Block of code
]]
---@class pandoc.CodeBlock
---@field text string Code string
---@field attr pandoc.Attr Cell attributes
---@field identifier string Alias for `attr.identifier`
---@field classes string[] Alias for `attr.classes`
---@field attributes table<string,string> Alias for `attr.attributes`
---@field t "CodeBlock"
---@field tag "CodeBlock"
pandoc.CodeBlock = {}

--[[
Creates a code block element
]]
---@param text string Code string
---@param attr? pandoc.Attr Cell attributes
---@return pandoc.CodeBlock
function pandoc.CodeBlock(text, attr) end

--[[
Make a clone
]]
---@return pandoc.CodeBlock
function pandoc.CodeBlock:clone() end

--[[
Apply a Lua filter
]]
---@param lua_filter table<string,function> Map of filter functions
---@return pandoc.CodeBlock 
function pandoc.CodeBlock:walk(lua_filter) end

