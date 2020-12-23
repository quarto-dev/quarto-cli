-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC


-- extended figure features including fig.align, fig.env, etc.
function extendedFigures() 
  return {
    
    Para = function(el)
      local image = discoverFigure(el)
      if image then
        if isHtmlOutput() then
          return htmlImageFigure(image)
        elseif isLatexOutput() then
          return latexImageFigure(image)
        elseif isDocxOutput() then
          return wpFigure(image)
        end
      end
    end,
    
    Div = function(el)
      if isFigureDiv(el) then
        if isLatexOutput() then
          return latexDivFigure(el)
        elseif isHtmlOutput() then
          return htmlDivFigure(el)
        elseif isDocxOutput() then
          return wpFigure(el)
        end
      end
    end
    
  }
end
