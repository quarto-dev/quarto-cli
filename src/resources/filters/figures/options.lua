-- options.lua
-- Copyright (C) 2020 by RStudio, PBC

-- initialize options from 'crossref' metadata value
function initOptions()
  return {
    Pandoc = function(doc)
       figures.options = readFilterOptions(doc, "figures")
    end
  }
end

-- get option value
function option(name, default)
  return readOption(figures.options, name, default)
end



