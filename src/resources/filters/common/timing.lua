-- timing.lua
-- Copyright (C) 2022 by RStudio, PBC

-- https://stackoverflow.com/questions/463101/lua-current-time-in-milliseconds :(
function get_current_time()
  -- FIXME this will not necessarily work on windows..
  local handle = io.popen("python -c 'import time; print(time.time() * 1000)'")
  if handle then
    local result = tonumber(handle:read("*a"))
    handle:close()
    return result
  else
    fail('Error reading current time')
  end
end

if os.getenv("QUARTO_PROFILER_OUTPUT") ~= nil then
  timing_events = { { name = "_start", time = get_current_time() } }
else
  timing_events = {}
end

function register_time(event_name)
  local t = get_current_time()
  table.insert(timing_events, { 
    time = t,
    name = event_name
  })
end

function capture_timings(filterList)
  local finalResult = {}

  if os.getenv("QUARTO_PROFILER_OUTPUT") ~= nil then
    for i, v in ipairs(filterList) do
      local newFilter = {}
      newFilter._filter_name = v["name"]

      local oldPandoc = v["filter"]["Pandoc"]
      for key,func in pairs(v) do
        newFilter[key] = func
      end
      function makeNewFilter(oldPandoc)
        return function (p)
          if oldPandoc ~= nil then
            local result = oldPandoc(p)
            register_time(v["name"])
            return result
          else
            register_time(v["name"])
          end
        end 
      end
      newFilter["Pandoc"] = makeNewFilter(oldPandoc) -- iife for capturing in scope
      table.insert(finalResult, newFilter)
    end
  else
    for _, v in ipairs(filterList) do
      if v.filter ~= nil then
        v.filter._filter_name = v.name
        table.insert(finalResult, v.filter)
      elseif v.filters ~= nil then
        for i, innerV in pairs(v.filters) do
          innerV._filter_name = string.format("%s-%s", v.name, i)
          table.insert(finalResult, innerV)
        end
      else
        print("Warning: filter " .. v.name .. " didn't declare filter or filters.")
      end
    end
  end

  return finalResult
end