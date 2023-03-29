--[[
  A low-overhead minimal lua profiler
]]

local getTime = os.clock
local module = {}
local outputfile

-- local function functionReport(information)
--   local src = information.source or "<C>"
--   local name = information.name
--   if not name then
--     name = "Anon"
--   elseif string.sub(name, #name - 1, #name) == "_l" then
--     name = string.sub(name, 1, #name - 2)
--   end
--   local title = string.format(outputTitle, src, name,
--   string.format(formatFunLine, information.linedefined or 0))
--   local report = reportCache[title]
--   if not report then
--     report = {
--       title = string.format(outputTitle, src, name,
--       string.format(formatFunLine, information.linedefined or 0)),
--       count = 0, timer = 0,
--     }
--     reportCache[title] = report
--     reportCount = reportCount + 1
--     allReports[reportCount] = report
--   end
--   return report
-- end

local names = { }
local nnames = 0

local onDebugHook = function(hookType)
  local information = debug.getinfo(2, "nS")
  if information.source == "=[C]" then
    return
  end
  if information.source:sub(1, 1) ~= "@" then
    return
  end

  local name = information.name or "<C>"
  local source = information.source

  if names[source] == nil then
    names[source] = nnames
    nnames = nnames + 1
  else
    source = names[source]
  end

  if names[name] == nil then
    names[name] = nnames
    nnames = nnames + 1
  else
    name = names[name]
  end

  if names[hookType] == nil then
    names[hookType] = nnames
    nnames = nnames + 1
  else
    hookType = names[hookType]
  end

  outputfile:write(hookType, " ", name, " ", source, " ", information.linedefined, " ", getTime(), "\n")
end

function module.start()
  outputfile = io.open("profiler.txt", "a")
  if outputfile == nil then
    error("Could not open profiler.txt for writing")
    return
  end
  debug.sethook(onDebugHook, "cr", 0)
end

function module.stop()
  debug.sethook()
  outputfile:close()
end

return module
