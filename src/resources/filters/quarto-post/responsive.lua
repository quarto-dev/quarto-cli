-- responsive.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function responsive() 
  return {
    -- make images responsive (unless they have an explicit height attribute)
    Image = function(image)
      if _quarto.format.isHtmlOutput() and param('fig-responsive', false) then
        if not image.attr.attributes["height"] and not image.attr.attributes["data-no-responsive"] then
          image.attr.classes:insert("img-fluid")
          return image
        end
      end
    end
  }
end

