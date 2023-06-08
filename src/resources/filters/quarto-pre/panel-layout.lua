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

  slots = { "preamble", "cells" },

  -- NB this constructor mutates the .attributes field!
  constructor = function(tbl)
    -- compute vertical alignment and remove attribute
    if tbl.attributes == nil then
      tbl.attributes = {}
    end
    local vAlign = validatedVAlign(tbl.attributes[kLayoutVAlign])
    tbl.attributes[kLayoutVAlign] = nil
    tbl.valign_class = vAlignClass(vAlign)

    -- construct a minimal rows-cells div scaffolding
    -- so contents are properly stored in the cells slot
    local cells_div = pandoc.Div({})
    for i, row in ipairs(tbl.cells) do
      cells_div.content:insert(pandoc.Div(row))
    end
    tbl.cells = cells_div

    return tbl
  end
})