-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.11.2'

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
import("wp.lua")
import("docx.lua")
import("odt.lua")
import("pptx.lua")
import("table.lua")
import("../common/json.lua")
import("../common/pandoc.lua")
import("../common/format.lua")
import("../common/layout.lua")
import("../common/figures.lua")
import("../common/params.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/debug.lua")
-- [/import]

function layoutFigures() 
  
  return {
    
    Div = function(el)
      
      if isFigureDiv(el, false) then
        
        -- handle subfigure layout
        local code, subfigures = layoutSubfigures(el)
        if subfigures then
          if isLatexOutput() then
            subfigures = latexPanel(el, subfigures)
          elseif isHtmlOutput() then
            subfigures = htmlPanel(el, subfigures)
          elseif isDocxOutput() then
            subfigures = tableDocxPanel(el, subfigures)
          elseif isOdtOutput() then
            subfigures = tableOdtPanel(el, subfigures)
          elseif isWordProcessorOutput() then
            subfigures = tableWpPanel(el, subfigures)
          elseif isPowerPointOutput() then
            subfigures = pptxPanel(el, subfigures)
          else
            subfigures = tablePanel(el, subfigures)
          end
          
          -- we have code then wrap the code and subfigues in a div
          if code then
            local div = pandoc.Div(code)
            div.content:insert(subfigures)
            return div
          -- otherwise just return the subfigures
          else
            return subfigures
          end
          
        -- turn figure divs into <figure> tag for html
        elseif isHtmlOutput() then
          return htmlDivFigure(el)
          
        -- other non-subfigure figure div implementations
        elseif not isSubfigure(el) then
          -- turn figure divs into \begin{figure} for latex 
          if isLatexOutput() then
            return latexDivFigure(el)
          -- use tables to align wp figures
          elseif isDocxOutput() and alignAttribute(el) ~= nil then
            return wpFigure(el)
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
        elseif isDocxOutput() and alignAttribute(image) ~= nil then
          return wpFigure(image)
        end
      end
    end
  }
end


-- chain of filters
return {
  initParams(),
  preprocessFigures(false),
  layoutFigures(),
  metaInject()
}


