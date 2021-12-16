-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- extended figure features including fig-align, fig-env, etc.
function extendedFigures() 
  return {
    
    Para = function(el)
      local image = discoverFigure(el, false)
      if image and shouldHandleExtendedImage(image) then
        if isHtmlOutput() then
          return htmlImageFigure(image)
        elseif isLatexOutput() then
          return latexImageFigure(image)
        end
      end
    end,
    
    Div = function(el)
      if isFigureDiv(el) and shouldHandleExtended(el) then
        if isLatexOutput() then
          return latexDivFigure(el)
        elseif isHtmlOutput() then
          return htmlDivFigure(el)
        elseif isDocxOutput() then
          return wpDivFigure(el)
        end
      end
    end
    
  }
end

local kFigExtended = "fig.extended"

function preventExtendedFigure(el)
  el.attr.attributes[kFigExtended] = "false"
end

function forceExtendedFigure(el) 
  el.attr.attributes[kFigExtended] = "true"
end

function shouldHandleExtended(el)
  return el.attr.attributes[kFigExtended] ~= "false"
end

-- By default, images without captions should be
-- excluded from extended processing. 
function shouldHandleExtendedImage(el) 
  -- handle extended if there is a caption
  if el.caption and #el.caption > 0 then
    return true
  end

  -- handle extended if there are fig- attributes
  local keys = tkeys(el.attr.attributes)
  for _,k in pairs(keys) do
    if isFigAttribute(k) then
      return true
    end
  end

  -- handle extended if there is column or caption 
  -- classes
  if hasColumnClasses(el) then
    return true
  end

  -- handle extended if it was explicitly enabled
  if el.attr.attributes[kFigExtended] == "true" then
    return true
  end

  -- otherwise, by default, do not handle
  return false
end
