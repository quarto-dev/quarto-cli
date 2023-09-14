-- pandoc3_figure.lua
-- Copyright (C) 2023 Posit Software, PBC

-- Figure nodes (from Pandoc3) can exist in our AST. They're
-- never cross-referenceable but they need to be rendered as 
-- if they were.

function render_pandoc3_figure()
  if _quarto.format.isHtmlOutput() then
    return {
      traverse = "topdown",
      Figure = function(figure)
        local image
        _quarto.ast.walk(figure, {
          Image = function(img)
            image = img
          end
        })
        if image == nil then
          return figure
        end
        if figure.caption.long ~= nil then
          image.caption = quarto.utils.as_inlines(figure.caption.long)
        end
        return htmlImageFigure(image)
      end
    }
  else
    return {}
  end
end
