-- cellcleanup.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

function cell_cleanup()
  
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
