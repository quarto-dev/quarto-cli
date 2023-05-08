-- panel-input.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function bootstrap_panel_input() 

  return {
    Div = function(el)
      if hasBootstrap() and el.attr.classes:find("panel-input") then
        tappend(el.attr.classes, {
          "card",
          "bg-light",
          "p-2",
        })
      end
      return el
    end
  }


end

