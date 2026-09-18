-- options.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- initialize options from 'crossref' metadata value
function init_crossref_options(meta)
  crossref.options = readFilterOptions(meta, "crossref")

  -- automatically set maxHeading to 1 if we are in chapters mode, otherwise set to max (7)
  if crossrefOption("chapters", false) then
    crossref.maxHeading = 1
  else
    crossref.maxHeading = 7
  end
end

-- get option value
function crossrefOption(name, default)
  return readOption(crossref.options, name, default)
end

-- we need to expose this function for use in Q2's Route-N Lua shim, which
-- reconstructs Q1 custom nodes outside the normal filter pipeline
quarto.doc.crossref.crossrefOption = crossrefOption



