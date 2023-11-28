-- figures.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function quarto_pre_figures() 
  -- provide default fig-pos or fig-env if specified
  local function forward_pos_and_env(el)
    local figPos = param(kFigPos)
    if figPos and not el.attributes[kFigPos] then
      el.attributes[kFigPos] = figPos
    end
    -- remove fig-pos if it is false, since it
    -- signals "don't use any value"
    if el.attributes[kFigPos] == "FALSE" then
      el.attributes[kFigPos] = nil
    end
    local figEnv = param(kFigEnv)
    
    if figEnv and not el.attributes[kFigEnv] then
      el.attributes[kFigEnv] = figEnv
    end
    return el
end
  return {    
    FloatRefTarget = function(float)
      local kind = refType(float.identifier)
      if kind ~= "fig" then
        return
      end

      -- propagate fig-alt
      if _quarto.format.isHtmlOutput() then
        -- read the fig-alt text and set the image alt
        local altText = attribute(float, kFigAlt, nil)
        if altText ~= nil then
          float.attributes["alt"] = altText
          float.attributes[kFigAlt] = nil
          return float
        end
      elseif _quarto.format.isLatexOutput() then
        return forward_pos_and_env(float)
      end
    end,
    Figure = function(figure)
      if _quarto.format.isLatexOutput() then
        return forward_pos_and_env(figure)
      end
    end
  }
end



