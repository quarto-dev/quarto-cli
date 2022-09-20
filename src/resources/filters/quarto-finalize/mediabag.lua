-- quarto-finalize.lua
-- Copyright (C) 2022 by RStudio, PBC

function mediabag()
  return {
    -- mediabag entries need to be re-routed to the filesystem
    -- if this isn't an office doc (as those formats automatically
    -- scoop up mediabag files)
    Image = function(el)
      if not _quarto.format.isWordProcessorOutput() and
         not _quarto.format.isPowerPointOutput() then
        local mt, contents = pandoc.mediabag.lookup(el.src)
        if contents ~= nil then
          local mediabagDir = param("mediabag-dir", nil)
          local mediaFile = pandoc.path.join{mediabagDir, el.src}
          local file = io.open(mediaFile, "wb")
          if file then
            file:write(contents)
            file:close()
          else
            warn('failed to write mediabag entry: ' .. mediaFile)
          end
          el.src = mediaFile
          return el
        end
      end
    end
  }
end