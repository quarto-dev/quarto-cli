-- responsive.lua
-- Copyright (C) 2021 by RStudio, PBC

function responsive() 
  return {
    -- make images responsive (unless they have an explicit height attribute)
    Image = function(image)
      if isHtmlOutput() and param('fig-responsive', false) then
        if not image.attr.attributes["height"] and not image.attr.attributes["data-no-responsive"] then
          image.attr.classes:insert("img-fluid")
          return image
        end
      end
    end
  }
end

