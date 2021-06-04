-- bootstrap.lua
-- Copyright (C) 2021 by RStudio, PBC

function bootstrap() 
  return {
    -- make images responsive (unless they have an explicit height attribute)
    Image = function(image)
      if isHtmlOutput() and hasBootstrap() then
        if not image.attr.attributes["height"] then
          image.attr.classes:insert("img-fluid")
          return image
        end
      end
    end
  }
end

