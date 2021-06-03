-- panel-input.lua
-- Copyright (C) 2021 by RStudio, PBC

function panelInput() 

  return {
    Div = function(el)
      if hasBootstrap() and el.attr.classes:find("panel-input") then
        tappend(el.attr.classes, {
          "card",
          "bg-light",
          "p-2",
        })

        return el
      end

    end
  }


end

