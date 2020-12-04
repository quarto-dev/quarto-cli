-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required modules
text = require 'text'

-- [import]
function import(script)
  -- The system separator
  local pathseparator = package.config:sub(1,1)
  
  -- convert our import to use the current system sep
  local safeScript = string.gsub(script, "/", "\\")
  
  local path = PANDOC_SCRIPT_FILE:match("(.*" .. pathseparator .. ")")
  dofile(path .. safeScript)
end
import("meta.lua")
import("layout.lua")
import("latex.lua")
import("table.lua")
import("../common/json.lua")
import("../common/pandoc.lua")
import("../common/figures.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/debug.lua")
-- [/import]

function figures() 
  
  return {
    
    Div = function(el)
      if isFigureDiv(el) then
        local subfigures = layoutSubfigures(el)
        if subfigures then
          if isLatexOutput() then
            return latexPanel(el, subfigures)
          else
            return tablePanel(el, subfigures)
          end
        elseif not isSubfigure(el) then
          -- deal with a div-based figures (subfigures will be dealt with above)
          -- e.g. place in <figure> tags for html
        end
      end
      

    end,
    
    Para = function(el)
      local image = figureFromPara(el)
      if image and not isSubfigure(image) then
        -- deal with image based figures
      end
    end
    
  }
end





-- chain of filters
return {
  labelSubfigures(),
  figures(),
  metaInject()
}


