-- tikz.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function tikz()
  if _quarto.format.isLatexOutput() then
    return {
      Image = function(image)
        if latexIsTikzImage(image) then
          return latexFigureInline(image)
        end
      end
    }
  else
    return {}
  end
end