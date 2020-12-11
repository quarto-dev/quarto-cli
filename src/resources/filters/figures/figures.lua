-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required modules
text = require 'text'

-- global figures state
figures = {}

-- [import]
function import(script)
  -- The system separator
  local pathseparator = package.config:sub(1,1)
  
  -- convert our import to use the current system sep
  local safeScript = string.gsub(script, "/", pathseparator)
  
  local path = PANDOC_SCRIPT_FILE:match("(.*" .. pathseparator .. ")")
  dofile(path .. safeScript)
end
import("meta.lua")
import("layout.lua")
import("latex.lua")
import("html.lua")
import("table.lua")
import("table-docx.lua")
import("../common/json.lua")
import("../common/pandoc.lua")
import("../common/format.lua")
import("../common/figures.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/debug.lua")
-- [/import]

function layoutFigures() 
  
  return {
    
    Div = function(el)
      
      if isFigureDiv(el, false) then
        
        -- handle subfigure layout
        local subfigures = layoutSubfigures(el)
        if subfigures then
          if isLatexOutput() then
            return latexPanel(el, subfigures)
          elseif isHtmlOutput() then
            return htmlPanel(el, subfigures)
          elseif isDocxOutput() then
            return tableDocxPanel(el, subfigures)
          else
            return tablePanel(el, subfigures)
          end
          
        -- turn figure divs into <figure> tag for html
        elseif isHtmlOutput() then
          return htmlDivFigure(el)
          
        -- turn figure divs into \begin{figure} for latex (but not if they
        -- have a parent as that will be done during subfigure layout)
        elseif isLatexOutput() and not isSubfigure(el)  then
          return latexDivFigure(el)
        end
      end
    end,
    
    Para = function(el)
      local image = figureFromPara(el, false)
      if image and not isSubfigure(image) then
        if isHtmlOutput() then
          return htmlImageFigure(image)
        elseif isLatexOutput() then
          return latexImageFigure(image)
        end
      end
    end
  }
end


-- chain of filters
return {
  preprocessFigures(false),
  layoutFigures(),
  metaInject()
}


