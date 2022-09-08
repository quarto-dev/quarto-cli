-- results.lua
-- Copyright (C) 2020 by RStudio, PBC


local function resultsFile()
  return pandoc.utils.stringify(param("results-file"))
end

local function timingsFile()
  return pandoc.utils.stringify(param("timings-file"))
end


-- write results
function writeResults()
  return {
    Pandoc = function(doc)
      if os.getenv("QUARTO_PROFILER_OUTPUT") ~= nil then
        local jsonResults = quarto.json.encode(preState.results)
        local rfile = io.open(resultsFile(), "w")
        rfile:write(jsonResults)
        rfile:close()

        local jsonTimings = quarto.json.encode(timing_events)
        local tfile = io.open(timingsFile(), "w")
        tfile:write(jsonTimings)
        tfile:close()
      end
    end
  }
end

