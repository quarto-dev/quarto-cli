---@meta

quarto = {}

-- Custom AST node constructors
-- These are injected onto quarto.* via the add_handler mechanism in
-- src/resources/filters/ast/customnodes.lua. Block-kind nodes return
-- pandoc.Div; Inline-kind nodes return pandoc.Span.

--[[
Create a FloatRefTarget node for cross-referenceable floats (figures, tables, etc.).

Accepts `attr` as a convenience shorthand that is unpacked into
`identifier`, `classes`, and `attributes`.
]]
---@param tbl { identifier: string, classes: nil|pandoc.List, attributes: nil|table, content: pandoc.Blocks|pandoc.Block, caption_long: nil|pandoc.Blocks, caption_short: nil|pandoc.Inlines, type: nil|string, parent_id: nil|string, attr: nil|pandoc.Attr }
---@return pandoc.Div, table
function quarto.FloatRefTarget(tbl) end

--[[
Create a DecoratedCodeBlock node (code block with filename header or caption).
]]
---@param tbl { code_block: pandoc.CodeBlock|pandoc.Blocks, filename: nil|string, caption: nil|pandoc.Inlines, hold: nil|boolean }
---@return pandoc.Div, table
function quarto.DecoratedCodeBlock(tbl) end

--[[
Create a ConditionalBlock node for content-visible/content-hidden divs.
]]
---@param tbl { node: pandoc.Div, behavior: string, condition: table[] }
---@return pandoc.Div, table
function quarto.ConditionalBlock(tbl) end

--[[
Create an HtmlTag node for raw HTML element wrappers.

Accepts `attr` as a convenience shorthand that is unpacked into
`identifier`, `classes`, and `attributes`.
]]
---@param tbl { name: string, content: nil|pandoc.Blocks, identifier: nil|string, classes: nil|table, attributes: nil|table, attr: nil|pandoc.Attr }
---@return pandoc.Div, table
function quarto.HtmlTag(tbl) end

--[[
Create a PanelLayout node for arranging content in a grid.

Can be float-backed (when `float` is provided) or standalone.
`layout` is a 2D array (rows of cells) of pandoc.Div elements.
When `float` is provided, the constructor copies `identifier`, `classes`,
`attributes`, `caption_long`, `caption_short`, `order`, and `type` from it.
]]
---@param tbl { layout: table, float: nil|table, preamble: nil|pandoc.Blocks, attr: nil|pandoc.Attr, caption_long: nil|pandoc.Blocks, caption_short: nil|pandoc.Inlines }
---@return pandoc.Div, table
function quarto.PanelLayout(tbl) end

--[[
Create a LatexInlineCommand node (e.g. `\textbf{arg}`).
]]
---@param tbl { name: string, arg: nil|pandoc.Inlines|pandoc.Inline, opt_arg: nil|pandoc.Inlines|pandoc.Inline }
---@return pandoc.Span, table
function quarto.LatexInlineCommand(tbl) end

--[[
Create a LatexBlockCommand node (e.g. `\chapter{arg}`).
]]
---@param tbl { name: string, arg: nil|pandoc.Blocks|pandoc.Block, opt_arg: nil|pandoc.Inlines|pandoc.Inline }
---@return pandoc.Div, table
function quarto.LatexBlockCommand(tbl) end

--[[
Create a LatexEnvironment node (e.g. `\begin{equation}...\end{equation}`).

`pos` is an optional positional argument passed to `\begin{name}[pos]`.
]]
---@param tbl { name: string, pos: nil|string, content: nil|pandoc.Blocks }
---@return pandoc.Div, table
function quarto.LatexEnvironment(tbl) end

--[[
Create a Shortcode node for shortcode processing.

This constructor opts out of default emulation (returns `tbl, false`) and
is typically called with a pre-built scaffold via
`_quarto.ast.create_custom_node_scaffold`.
]]
---@param tbl { name: string|number, params: table[], unparsed_content: nil|string }
---@return pandoc.Span, table
function quarto.Shortcode(tbl) end

--[[
Create a Proof node for mathematical proofs.

`type` is required because proofs can be unnumbered and lack an identifier.
]]
---@param tbl { name: nil|pandoc.Inlines|string, div: pandoc.Div, identifier: string, type: string }
---@return pandoc.Div, table
function quarto.Proof(tbl) end

--[[
Create a Theorem node for mathematical theorems, lemmas, corollaries, etc.
]]
---@param tbl { name: nil|pandoc.Inlines|string, div: pandoc.Div|pandoc.Blocks, identifier: string }
---@return pandoc.Div, table
function quarto.Theorem(tbl) end
