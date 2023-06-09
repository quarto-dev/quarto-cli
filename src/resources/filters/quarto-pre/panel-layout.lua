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
    tbl.classes = tbl.float.classes
    tbl.identifier = tbl.float.identifier
    tbl.attributes = tbl.float.attributes
    tbl.caption_long = tbl.float.caption_long
    tbl.order = tbl.float.order
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
      rows_div.content:insert(_quarto.ast.walk(row_div, {
        traverse = "topdown",
        Div = function(div)
          local found = false
          -- if it has a ref parent then give it another class
          -- (used to provide subcaption styling)
          local new_div = _quarto.ast.walk(div, {
            FloatCrossref = function(float)
              if float.parent_id then
                div.attr.classes:insert("quarto-layout-cell-subref")
              end
            end,
          })
          return div
        end,
      }) or {}) -- this isn't needed but the type system doesn't know that
    end
    tbl.rows = rows_div

    return tbl
  end
})