-- options.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- initialize options from 'crossref' metadata value
function init_crossref_options()
  return {
    Meta = function(meta)
      crossref.options = readFilterOptions(meta, "crossref")

      -- automatically set maxHeading to 1 if we are in chapters mode, otherwise set to max (7)
      if crossrefOption("chapters", false) then
        crossref.maxHeading = 1
      else
        crossref.maxHeading = 7
      end

    end
  }
end

-- get option value
function crossrefOption(name, default)
  return readOption(crossref.options, name, default)
end



