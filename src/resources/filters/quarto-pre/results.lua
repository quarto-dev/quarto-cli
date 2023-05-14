-- results.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


local function resultsFile()
  return pandoc.utils.stringify(param("results-file"))
end

local function timingsFile()
  return pandoc.utils.stringify(param("timings-file"))
end


-- write results
function write_results()
  return {
    Pandoc = function(doc)
      local jsonResults = quarto.json.encode(preState.results)
      local rfile = io.open(resultsFile(), "w")
      if rfile then
        rfile:write(jsonResults)
        rfile:close()
      else
        warn('Error writing LUA results file')
      end

      -- FIXME: we don't use this anymore, remove it
      if os.getenv("QUARTO_PROFILER_OUTPUT") ~= nil then

        local jsonTimings = quarto.json.encode(timing_events)
        local tfile = io.open(timingsFile(), "w")
        if tfile then
          tfile:write(jsonTimings)
          tfile:close()
        else
          warn('Error writing profiler timings JSON')
        end
      end
    end
  }
end

