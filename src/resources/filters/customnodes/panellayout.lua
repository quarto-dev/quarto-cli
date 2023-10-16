-- panellayout.lua
-- Copyright (C) 2023 Posit Software, PBC

local function parse_width(value)
  if value:sub(-1) == "%" then
    return tonumber(value:sub(1, -2)) / 100
  else
    return tonumber(value)
  end
end

function forward_widths_to_subfloats(layout)
  -- forward computed widths to the subfloats
  local width_table = {}
  
  for i, row in ipairs(layout.layout) do
    for j, cell in ipairs(row) do
      local width = cell.attributes["width"]
      if is_regular_node(cell, "Div") and width then
        local data = _quarto.ast.resolve_custom_data(cell)
        _quarto.ast.walk(cell, {
          FloatRefTarget = function(float)
            local id = float.identifier
            width_table[id] = parse_width(width)
          end
        })
      end
    end
  end
  
  _quarto.ast.walk(layout.float, {
    FloatRefTarget = function(float)
      local id = float.identifier
      if width_table[id] then
        float.width = width_table[id]
      end
    end
  })
end

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "PanelLayout",

  -- float crossrefs are always blocks
  kind = "Block",

  parse = function(div)
    -- luacov: disable
    internal_error()
    -- luacov: enable
  end,

  slots = { "preamble", "rows", "caption_long", "caption_short" },

  -- NB this constructor mutates the .attributes field!
  constructor = function(tbl)
    if tbl.float then
      tbl.is_float_reftarget = true
      tbl.classes = tbl.float.classes
      tbl.identifier = tbl.float.identifier
      tbl.attributes = tbl.float.attributes
      tbl.caption_long = tbl.float.caption_long
      tbl.caption_short = tbl.float.caption_short
      tbl.order = tbl.float.order
      tbl.type = tbl.float.type
    else
      tbl.is_float_reftarget = false
      if tbl.attr then
        tbl.identifier = tbl.attr.identifier
        tbl.classes = tbl.attr.classes
        tbl.attributes = as_plain_table(tbl.attr.attributes)
        tbl.attr = nil
      end
      tbl.preamble = pandoc.Div(tbl.preamble)
    end
    -- compute vertical alignment and remove attribute
    if tbl.attributes == nil then
      tbl.attributes = {}
    end
    local vAlign = validatedVAlign(tbl.attributes[kLayoutVAlign])
    tbl.attributes[kLayoutVAlign] = nil
    tbl.valign_class = vAlignClass(vAlign)

    -- construct a minimal rows-cells div scaffolding
    -- so contents are properly stored in the cells slot

    local rows_div = pandoc.Div({})
    for i, row in ipairs(tbl.layout) do
      local row_div = pandoc.Div(row)
      if tbl.is_float_reftarget then
        row_div = _quarto.ast.walk(row_div, {
          traverse = "topdown",
          Div = function(div)
            local found = false
            -- if it has a ref parent then give it another class
            -- (used to provide subcaption styling)
            local new_div = _quarto.ast.walk(div, {
              FloatRefTarget = function(float)
                if float.parent_id then
                  div.attr.classes:insert("quarto-layout-cell-subref")
                  div.attr.attributes["ref-parent"] = float.parent_id
                end
              end,
            })
            return div
          end,
        }) or {} -- this isn't needed but the type system doesn't know that
      end
      rows_div.content:insert(row_div)
    end
    tbl.rows = rows_div

    if tbl.float then 
      forward_widths_to_subfloats(tbl)
    end

    return tbl
  end
})

_quarto.ast.add_renderer("PanelLayout", function (panel)
  return true
end, function(panel)
  warn("No renderer for PanelLayout")
  if panel.float then
    return panel.float
  end

  warn("Don't know how to render PanelLayout without a float; will return empty output")
  return pandoc.Div({})

end)

-- we mostly use this function as a template to copy-and-paste into
-- other functions.
-- This is pretty ugly, but the kinds of things that need to change across
-- formats are not always the same, so it's hard to make a generic function
function basic_panel_layout(layout)
  if layout.float == nil then
    fail_and_ask_for_bug_report("Can't render layouts without floats")
    return pandoc.Div({})
  end
  decorate_caption_with_crossref(layout.float)

  -- empty options by default
  if not options then
    options = {}
  end
  -- outer panel to contain css and figure panel
  local attr = pandoc.Attr(layout.identifier or "", layout.classes or {}, layout.attributes or {})
  local panel_content = pandoc.Blocks({})
  -- layout
  for i, row in ipairs(layout.layout) do
    
    local aligns = row:map(function(cell) 
      -- get the align
      local align = cell.attributes[kLayoutAlign]
      return layoutTableAlign(align) 
    end)
    local widths = row:map(function(cell) 
      -- propagage percents if they are provided
      local layoutPercent = horizontalLayoutPercent(cell)
      if layoutPercent then
        return layoutPercent / 100
      else
        return 0
      end
    end)

    local cells = pandoc.List()
    for _, cell in ipairs(row) do
      cells:insert(cell)
    end
    
    -- make the table
    local panelTable = pandoc.SimpleTable(
      pandoc.List(), -- caption
      aligns,
      widths,
      pandoc.List(), -- headers
      { cells }
    )
    
    -- add it to the panel
    panel_content:insert(pandoc.utils.from_simple_table(panelTable))
  end

  local result = pandoc.Div({})
  result.content:extend(panel_content)

  if layout.float.caption_long then
    result.content:insert(pandoc.Para(quarto.utils.as_inlines(layout.float.caption_long) or {}))
  end

  local res = pandoc.Blocks({})
  panel_insert_preamble(res, layout.preamble)
  res:insert(result)
  
end