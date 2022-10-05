---@meta

---@alias table_alignment 'AlignDefault'|'AlignLeft'|'AlignCenter'|'AlightRight'


---@class pandoc.Table
pandoc.Table = {}

--[[
A simple table is a table structure which resembles the old (pre
pandoc 2.10) Table type. Bi-directional conversion from and to
Tables is possible with the `pandoc.utils.to_simple_table`
and `pandoc.utils.from_simple_table` functions, respectively. 
Instances of this type can also be created directly with the 
`pandoc.SimpleTable`constructor.
]]
---@class pandoc.SimpleTable 
---@field caption pandoc.List List of inlines
---@field aligns pandoc.List List of table alignments
---@field widths number[] Column widths
---@field headers pandoc.List Table header row (a list of blocks, one for each cell)
---@field rows pandoc.List List of rows, where row is a list of blocks (one for each cell)
pandoc.SimpleTable = {}

--[[
Creates a simple table resembling the old (pre pandoc 2.10) table type.
]]
---@param caption inlines_content Inline or list of inlines
---@param aligns pandoc.List List of column alignments
---@param widths number[] Column widths
---@param headers pandoc.List Table header row (a list of blocks, one for each cell)
---@param rows pandoc.List List of rows, where row is a list of blocks (one for each cell)
---@return pandoc.SimpleTable 
function pandoc.SimpleTable(caption, aligns, widths, headers, rows) end

--[[
Make a clone
]]
---@return pandoc.SimpleTable
function pandoc.SimpleTable:clone() end
