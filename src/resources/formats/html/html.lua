-- html.lua
-- Copyright (C) 2021 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.11.2'


-- make images responsive (unless they have an explicit height attribute)
Image = function(image)
  if not image.attr.attributes["height"] then
    image.attr.classes:insert("img-fluid")
    return image
  end
end
