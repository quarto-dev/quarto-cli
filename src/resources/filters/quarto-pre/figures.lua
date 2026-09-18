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
      local kind = ref_type_from_float(float)
      if kind ~= "fig" then
        return
      end

      -- propagate fig-alt to Image elements for accessibility
      local altText = attribute(float, kFigAlt, nil)
      if altText ~= nil then
        if _quarto.format.isHtmlOutput() then
          -- HTML: set alt on the float itself
          float.attributes["alt"] = altText
        else
          -- LaTeX, Typst, and other formats: propagate to Image elements
          -- (enables \includegraphics[alt={...}] for LaTeX, image(alt: "...") for Typst)
          float.content = _quarto.ast.walk(float.content, {
            Image = function(image)
              image.attributes["alt"] = altText
              return image
            end
          })
        end
        float.attributes[kFigAlt] = nil
      end

      if _quarto.format.isLatexOutput() then
        return forward_pos_and_env(float)
      end

      if altText ~= nil then
        return float
      end
    end,
    Figure = function(figure)
      if _quarto.format.isLatexOutput() then
        return forward_pos_and_env(figure)
      end
    end
  }
end



