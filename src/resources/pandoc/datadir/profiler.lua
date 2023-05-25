--[[
  A low-overhead minimal lua profiler.

  It requires cooperation from the lua interpreter itself, which we patch, and then
  compile a custom pandoc binary.
  
  In other words, this is not meant to be used by regular quarto users.
]]

local getTime = os.clock
local module = {}
local outputfile
local stack_count = 0

-- don't colect coverage for this module
-- luacov: disable
local onDebugHook = function(hookType, line)
  local no = 2
  local information = debug.getinfo(no, "nS")
  local now = os.clock()
  while information ~= nil do
    local source = information.source or "unknown"
    local name = information.name or "anon"
    if string.match(source, ".lua$") then
      outputfile:write(name, " ", source, " ", information.linedefined, "\n")
    end
      no = no + 1
      information = debug.getinfo(no, "nS")
  end
  outputfile:write(stack_count, " ", now, " ", module.category, " ", line, "\n")
  stack_count = stack_count + 1
end

function module.start(filename)
  outputfile = io.open(filename, "a")
  if outputfile == nil then
    error("Could not open profiler.txt for writing")
    return
  end
  debug.sethook(onDebugHook, "t", 5) -- NB: "t" debugging only exists in our patched Lua interpreter/pandoc binary!
end

function module.stop()
  debug.sethook()
  outputfile:close()
end
-- luacov: enable

return module
