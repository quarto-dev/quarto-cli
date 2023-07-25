-- panel-layout.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function bootstrap_panel_layout() 

  return {
    Div = function(el)
      if (hasBootstrap() and el.t == "Div") then
        local fill = el.attr.classes:find("panel-fill")
        local center = el.attr.classes:find("panel-center")
        if fill or center then
          local layoutClass =  fill and "panel-fill" or "panel-center"
          local div = pandoc.Div({ el })
          el.attr.classes = el.attr.classes:filter(function(clz) return clz ~= layoutClass end)
          if fill then
            tappend(div.attr.classes, {
              "g-col-24",
            })
          elseif center then
            tappend(div.attr.classes, {
              "g-col-24",
              "g-col-lg-20",
              "g-start-lg-2"
            })
          end
          -- return wrapped in a raw
          return pandoc.Div({ div }, pandoc.Attr("", { 
            layoutClass,
            "panel-grid"
          }))
        end
      end
      return el
    end
  }
  
end

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
      if cell.t == "Div" and width then
        local data = _quarto.ast.resolve_custom_data(cell)
        _quarto.ast.walk(cell, {
          FloatCrossref = function(float)
            local id = float.identifier
            width_table[id] = parse_width(width)
          end
        })
      end
    end
  end
  
  _quarto.ast.walk(layout.float, {
    FloatCrossref = function(float)
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
    fail("PanelLayout nodes should not be parsed")
  end,

  slots = { "preamble", "rows", "caption_long" },

  -- NB this constructor mutates the .attributes field!
  constructor = function(tbl)
    if tbl.float then
      tbl.is_float_crossref = true
      tbl.classes = tbl.float.classes
      tbl.identifier = tbl.float.identifier
      tbl.attributes = tbl.float.attributes
      tbl.caption_long = tbl.float.caption_long
      tbl.order = tbl.float.order
      tbl.type = tbl.float.type
    else
      tbl.is_float_crossref = false
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
      if tbl.is_float_crossref then
        row_div = _quarto.ast.walk(row_div, {
          traverse = "topdown",
          Div = function(div)
            local found = false
            -- if it has a ref parent then give it another class
            -- (used to provide subcaption styling)
            local new_div = _quarto.ast.walk(div, {
              FloatCrossref = function(float)
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

    return tbl
  end
})