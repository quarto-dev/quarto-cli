-- options.lua
-- Copyright (C) 2020 by RStudio, PBC

-- initialize options from 'crossref' metadata value
function initCrossrefOptions()
  return {
    Meta = function(meta)
      crossref.options = readFilterOptions(meta, "crossref")
    end
  }
end

-- get option value
function crossrefOption(name, default)
  return readOption(crossref.options, name, default)
end



