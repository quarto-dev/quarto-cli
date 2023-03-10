-- discover_preview_images.lua
-- Copyright (C) 2023 Posit Software, PBC

local set = false
function discover_preview_images() 
  return {
    Image = function(el)
      if set then
        return nil
      end
      set = true
      el.classes:insert("quarto-discovered-preview-image")
      return el
    end
  }
end
