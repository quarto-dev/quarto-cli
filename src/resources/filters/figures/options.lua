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
  local value = readOption(figures.options, name, nil)
  if value then
    return value
  else
    local prefixed = "quarto-" .. name
    return readOption(figures.options, prefixed, default)
  end
end



