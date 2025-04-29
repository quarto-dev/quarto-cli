-- results.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


local function resultsFile()
  return pandoc.utils.stringify(param("results-file"))
end

-- write results
function write_results()
  return {
    Pandoc = function(doc)
      local jsonResults = quarto.json.encode(quarto_global_state.results)
      local rfile = io.open(resultsFile(), "w")
      if rfile then
        rfile:write(jsonResults)
        rfile:close()
      else
        warn('Error writing LUA results file')
      end
    end
  }
end

