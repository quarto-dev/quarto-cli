-- panel-layout.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function bootstrap_panel_layout() 

  return {
    Div = function(el)
      if (hasBootstrap() and is_regular_node(el, "Div")) then
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

function panel_insert_preamble(result, preamble)
  if preamble == nil then
    return
  end

  local pt = pandoc.utils.type(preamble)
  if preamble.content and #preamble.content > 0 then
    result:extend(preamble.content)
  elseif pt == "Inline" or pt == "Block" then
    result:insert(preamble)
  elseif pt == "Blocks" then
    result:extend(preamble)
  else
    fail("Don't know what to do with preamble of type " .. pt)
    return nil
  end
end