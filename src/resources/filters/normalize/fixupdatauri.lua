-- fixupdatauri.lua
-- Copyright (C) 2023 Posit Software, PBC

-- https://github.com/quarto-dev/quarto-cli/issues/6568
function normalize_fixup_data_uri_image_extension() 
  return {
    Image = function(img)
      local src = img.src
      if src:sub(1, 5) == "data:" then
        local l = PANDOC_READER_OPTIONS.default_image_extension:len()
        if src:sub(-l-1) == ("." .. PANDOC_READER_OPTIONS.default_image_extension) then
          img.src = src:sub(1, -l - 2)
          return img
        end
      end
    end
  }
end
