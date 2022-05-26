-- results.lua
-- Copyright (C) 2020 by RStudio, PBC


local function resultsFile()
  return pandoc.utils.stringify(param("results-file"))
end


-- write results
function writeResults()
  return {
    Pandoc = function(doc)
      local json = json.encode(preState.results)
      local file = io.open(resultsFile(), "w")
      file:write(json)
      file:close()
    end
  }
end

