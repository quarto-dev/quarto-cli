-- log.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- TODO
-- could write to named filed (e.g. <docname>.filter.log) and client could read warnings and delete (also delete before run)
-- always append b/c multiple filters

local function caller_info(offset)
  offset = offset or 3
  local caller = debug.getinfo(offset, "lS")
  return caller.source:sub(2,-1) .. ":" .. tostring(caller.currentline)
end

function info(message)
  io.stderr:write(message .. "\n")
end

function warn(message) 
  io.stderr:write(lunacolors.yellow("WARNING (" .. caller_info() .. ") " .. message .. "\n"))
end

function error(message)
  io.stderr:write(lunacolors.red("ERROR (" .. caller_info() .. ") " .. message .. "\n"))
end

function fatal(message)
  io.stderr:write(lunacolors.red("FATAL (" .. caller_info() .. ") " ..message .. "\n"))
  -- TODO write stack trace into log, and then exit.
  crash_with_stack_trace()  
end

