---@meta

---@alias table_alignment 'AlignDefault'|'AlignLeft'|'AlignCenter'|'AlightRight'


---@class pandoc.Table : table

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
---@field aligns table_alignment[] Column alignments
---@field widths number[] Column widths
---@field headers pandoc.List Table header row (a list of blocks, one for each cell)
---@field rows pandoc.List List of rows, where row is a list of blocks (one for each cell)

--[[
Creates a simple table resembling the old (pre pandoc 2.10) table type.
]]
---@param caption pandoc.List List of inlines
---@param aligns table<table_alignment> Column alignments
---@param widths number[] Column widths
---@param headers pandoc.List Table header row (a list of blocks, one for each cell)
---@param rows pandoc.List List of rows, where row is a list of blocks (one for each cell)
---@return pandoc.SimpleTable 
function pandoc.SimpleTable(caption, aligns, widths, headers, rows) end

