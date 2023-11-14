-- cellcleanup.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

function cell_cleanup()
  
  if _quarto.format.isDashboardOutput() then
    -- let fully empty code cells through for dashboards
    -- this is so that the example code
    -- that we provide (which has empty placeholder cells)
    -- can still render cards
    return {}
  else
    return {
      Div = function(div)
        if (#div.classes == 1 and 
            div.classes[1] == "cell" and
            #div.content == 0) then
          return {}
        end
      end
    }
  end
end
