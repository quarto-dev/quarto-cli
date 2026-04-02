---@meta

quarto = {}

---@alias quarto.Tab { content: pandoc.Blocks, title: pandoc.Inlines, active: boolean }

--[[
Create a Tab object for use in a Tabset.

String content is parsed as Markdown. The `active` field defaults to `false`.
]]
---@param params { content: nil|pandoc.Blocks|pandoc.Block|string, title: pandoc.Inlines|string, active: nil|boolean }
---@return quarto.Tab
function quarto.Tab(params) end

---@alias quarto.Tabset { level: number, tabs: quarto.Tab[], attr: pandoc.Attr }

--[[
Create a Tabset AST node containing multiple tabs.

Returns the scaffold Div node and the resolved Tabset data table.
]]
---@param params { level: nil|number, tabs: nil|quarto.Tab[], attr: nil|pandoc.Attr }
---@return pandoc.Div, quarto.Tabset
function quarto.Tabset(params) end
