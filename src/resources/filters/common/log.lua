-- log.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- TODO
-- could write to named filed (e.g. <docname>.filter.log) and client could read warnings and delete (also delete before run)
-- always append b/c multiple filters

function info(message)
  io.stderr:write(message .. "\n")
end

function warn(message) 
  io.stderr:write(lunacolors.yellow("WARNING: " .. message .. "\n"))
end

function error(message)
  io.stderr:write(lunacolors.red("ERROR: " .. message .. "\n"))
end

function fatal(message)
  io.stderr:write(lunacolors.red("ERROR: " .. message .. "\n"))
  -- TODO write stack trace into log, and then exit.
  crash_with_stack_trace()  
end

