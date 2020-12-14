-- options.lua
-- Copyright (C) 2020 by RStudio, PBC

-- initialize options from 'crossref' metadata value
function readFilterOptions(doc, filter)
  local options = {}
  if type(doc.meta[filter]) == "table" then
    options = doc.meta[filter]:clone()
  end
  return options
end

-- get option value
function readOption(options, name, default)
  local value = options[name]
  if value == nil then
    value = default
  end
  return value
end



