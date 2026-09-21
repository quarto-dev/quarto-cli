-- log.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- TODO
-- could write to named filed (e.g. <docname>.filter.log) and client could read warnings and delete (also delete before run)
-- always append b/c multiple filters

--- The default, built-in error function.
-- The `error` global is redefined below.
local builtin_error_function = error

-- luacov: disable
local function caller_info(offset)
  offset = offset or 3
  local caller = debug.getinfo(offset, "lS")
  return caller.source:sub(2,-1) .. ":" .. tostring(caller.currentline)
end

function info(message)
  io.stderr:write(message .. "\n")
end

function warn(message, offset) 
  io.stderr:write(lunacolors.yellow("WARNING (" .. caller_info(offset) .. ") " .. message .. "\n"))
end

function error(message, offset)
  io.stderr:write(lunacolors.red(("ERROR (%s) %s\n"):format(caller_info(offset), message)))
end

function fatal(message, offset)
  io.stderr:write(lunacolors.red("FATAL (" .. caller_info(offset) .. ") " ..message .. "\n"))
  -- TODO write stack trace into log, and then exit.
  builtin_error_function('FATAL QUARTO ERROR', offset)
end
-- luacov: enable
