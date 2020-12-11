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
import("office.lua")
import("docx.lua")
import("table.lua")
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
          
        -- other non-subfigure figure div implementations
        elseif not isSubfigure(el) then
          -- turn figure divs into \begin{figure} for latex 
          if isLatexOutput() then
            return latexDivFigure(el)
          -- use tables to align office figures
          elseif isOfficeOutput() and alignAttribute(el) ~= nil then
            return officeFigure(el)
          end
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
        elseif isOfficeOutput() and alignAttribute(image) ~= nil then
          return officeFigure(image)
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


