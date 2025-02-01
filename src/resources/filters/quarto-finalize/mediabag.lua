-- quarto-finalize.lua
-- Copyright (C) 2022 Posit Software, PBC

function mediabag_filter()
  return {
    -- mediabag entries need to be re-routed to the filesystem
    -- if this isn't an office doc (as those formats automatically
    -- scoop up mediabag files)
    Image = function(el)
      if not _quarto.format.isWordProcessorOutput() and
         not _quarto.format.isPowerPointOutput() then
        local mediaFile = _quarto.modules.mediabag.write_mediabag_entry(el.src)
        if mediaFile then
          el.src = mediaFile
          return el
        end
      end
    end
  }
end