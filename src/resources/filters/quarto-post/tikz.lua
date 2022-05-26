-- tikz.lua
-- Copyright (C) 2021 by RStudio, PBC

function tikz()
  if _quarto.format.isLatexOutput() then
    return {
      Image = function(image)
        if latexIsTikzImage(image) then
          return latexFigureInline(image, postState)
        end
      end
    }
  else
    return {}
  end
end