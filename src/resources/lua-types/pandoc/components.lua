---@meta

--[[
A set of element attributes. Values of this type can be created
with the [`pandoc.Attr`](#pandoc.attr) constructor. For
convenience, it is usually not necessary to construct the value
directly if it is part of an element, and it is sufficient to
pass an HTML-like table. E.g., to create a span with identifier
"text" and classes "a" and "b", one can write:

    local span = pandoc.Span('text', {id = 'text', class = 'a b'})

This also works when using the `attr` setter:

    local span = pandoc.Span 'text'
    span.attr = {id = 'text', class = 'a b', other_attribute = '1'}

Attr values are equal in Lua if and only if they are equal in
Haskell.
]]
---@class pandoc.Attr 
---@field identifier string Element identifier
---@field classes pandoc.List Element classes
---@field attributes table<string,string> Collection of key/value pairs
pandoc.Attr = {}

--[[
Create a new set of attributes (`Attr`).
]]
---@param identifier? string Element identifier
---@param classes? table Element classes
---@param attributes? table<string,string> Table containing string keys and values
---@return pandoc.Attr
function pandoc.Attr(identifier, classes, attributes) end

--[[
Make a clone
]]
---@return pandoc.Attr
function pandoc.Attr:clone() end


--[[
The caption of a table, with an optional short caption.
]]
---@class pandoc.Caption
---@field long pandoc.List Long caption (List of blocks) 
---@field short pandoc.List Short caption (List of inlines)
pandoc.Caption = {}

--[[
Make a clone
]]
---@return pandoc.Caption
function pandoc.Caption:clone() end


--[[
A table cell.
]]
---@class pandoc.Cell
---@field attr pandoc.Attr Cell attributes
---@field identifier string Alias for `attr.identifier`
---@field classes pandoc.List Alias for `attr.classes`
---@field attributes table<string,string> Alias for `attr.attributes`
---@field alignment table_alignment Individual cell alignment
---@field contents pandoc.List Cell contents (list of blocks)
---@field row_span integer Number of rows occupied by the call
---@field col_span integer Number of columns spanned by the cell
pandonc.Cell = {}

--[[
Create a new table cell
]]
---@param blocks pandoc.List Cell contents (list of blocks)
---@param align? table_alignment Text alignment (defaults to 'AlignDefault')
---@param rowspan? integer Number of rows occupied by the call; defaults to 1
---@param colspan? integer Number of columns spanned by the cell; defaults to 1
---@param attr? pandoc.Attr Cell attributes
---@return pandoc.Cell
function pandoc.Cell(blocks, align, rowspan, colspan, attr) end

--[[
Make a clone
]]
---@return pandoc.Cell
function pandoc.Cell:clone() end


--[[
Single citation entry

Citation values are equal in Lua if and only if they are equal in
Haskell.
]]
---@class pandoc.Citation
---@field id string Citation identifier, e.g., a bibtex key 
---@field mode citation_mode Citation mode
---@field prefix pandoc.List Citation prefix
---@field suffix pandoc.List Citation suffix
---@field note_num integer Note number
---@field hash integer Hash
pandoc.Citation = {}

---@alias citation_mode 'AuthorInText'|'SuppressAuthor'|'NormalCitation'

--[[
Creates a single citation
]]
---@param id string Citation identifier, e.g., a bibtex key 
---@param mode citation_mode Citation mode
---@param prefix? pandoc.List Citation prefix
---@param suffix? pandoc.List Citation suffix
---@param note_num? integer Note number
---@param hash? integer Hash
---@return pandoc.Citation
function pandoc.Citation(id, mode, prefix, suffix, note_num, hash) end

--[[
Make a clone
]]
---@return pandoc.Citation
function pandoc.Citation:clone() end


--[[
Column alignment and width specification for a single table column.

-- This is a pair, i.e., a plain table, with the following
-- components:

-- 1. cell alignment
-- 2. table column width, as a fraction of the page width
]]
---@class pandoc.ColSpec : table
pandoc.ColSpec = {}


--[[
List attributes
]]
---@class pandoc.ListAttributes 
---@field start integer Number of the first list item
---@field style list_style Style used for list numbers
---@field delimiter list_delimeter Delimiter of list numbers
pandoc.ListAttributes = {}

---@alias list_style  'DefaultStyle'|'Example'|'Decimal'|'LowerRoman'|'UpperRoman'|'LowerAlpha'|'UpperAlpha'
---@alias list_delimeter 'DefaultDelim'|'Period'|'OneParen'|'TwoParens'

--[[
Create a set of list attributes
]]
---@param start? integer Number of the first list item
---@param style? list_style Style used for list numbers
---@param delimiter? list_delimeter Delimiter of list numbers
---@return pandoc.ListAttributes
function pandoc.ListAttributes(start, style, delimiter) end

--[[
Make a clone
]]
---@return pandoc.ListAttributes
function pandoc.ListAttributes:clone() end

--[[
A table row
]]
---@class pandoc.Row 
---@field attr pandoc.Attr Element attributes
---@field cells pandoc.List List of `Cell`
pandoc.Row = {}

--[[
Creates a table row
]]
---@param cells? pandoc.List List of `Cell`
---@param attr? pandoc.Attr Row attributes
---@return pandoc.Row
function pandoc.Row(cells, attr) end

--[[
Make a clone
]]
---@return pandoc.Row
function pandoc.Row:clone() end


--[[
A body of a table, with an intermediate head and the specified
number of row header columns.
]]
---@class pandoc.TableBody
---@field attr pandoc.Attr Table body attributes
---@field body pandoc.List List of `Row`
---@field head pandoc.List Intermediate head (list of `Row`)
---@field row_head_columns integer Number of columns taken up by the row head of each row of a `TableBody`. The row body takes up the remaining columns.
pandoc.TableBody = {}


--[[
Make a clone
]]
---@return pandoc.TableBody
function pandoc.TableBody:clone() end


--[[
The foot of a table
]]
---@class pandoc.TableFoot
---@field attr pandoc.Attr Element attributes
---@field identifier string Alias for `attr.identifier`
---@field classes pandoc.List Alias for `attr.classes`
---@field attributes table<string,string> Alias for `attr.attributes`
---@field rows pandoc.List List of `Row`
pandoc.TableFoot = {}

--[[
Creates a table foot
]]
---@param rows? pandoc.List List of `Row`
---@param attr? pandoc.Attr Element attributes
---@return pandoc.TableFoot
function pandoc.TableFoot(rows, attr) end

--[[
Make a clone
]]
---@return pandoc.TableFoot
function pandoc.TableFoot:clone() end



--[[
The head of a table
]]
---@class pandoc.TableHead
---@field attr pandoc.Attr Element attributes
---@field identifier string Alias for `attr.identifier`
---@field classes pandoc.List Alias for `attr.classes`
---@field attributes table<string,string> Alias for `attr.attributes`
---@field rows pandoc.List List of `Row`
pandoc.TableHead = {}

--[[
Creates a table head
]]
---@param rows? pandoc.List List of `Row`
---@param attr? pandoc.Attr Element attributes
---@return pandoc.TableHead
function pandoc.TableHead(rows, attr) end

--[[
Make a clone
]]
---@return pandoc.TableHead
function pandoc.TableHead:clone() end
