--[[
  A low-overhead minimal lua profiler
]]

local getTime = os.clock
local module = {}
local outputfile

local names = { }
local nnames = 0
module.category = ""

local onDebugHook = function(hookType)
  local information = debug.getinfo(2, "nS")
  if information.source == "=[C]" then
    return
  end
  if information.source:sub(1, 1) ~= "@" then
    return
  end

  local name = information.name or "<C>"
  local source = information.source or "unknown"
  if hookType == "tail call" then
    hookType = "tailcall"
  end

  if names[hookType] == nil then
    names[hookType] = nnames
    nnames = nnames + 1
  else
    hookType = names[hookType]
  end

  if names[name] == nil then
    names[name] = nnames
    nnames = nnames + 1
  else
    name = names[name]
  end

  if names[source] == nil then
    names[source] = nnames
    nnames = nnames + 1
  else
    source = names[source]
  end

  if type(module.category) == "string" and module.category ~= "" then
    if names[module.category] == nil then
      names[module.category] = nnames
      nnames = nnames + 1
    else
      module.category = names[module.category]
    end
  end

  outputfile:write(hookType, " ", name, " ", source, " ", information.linedefined, " ", getTime(), " ", module.category, "\n")
end

function module.start(filename)
  outputfile = io.open(filename, "a")
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
