-- log.lua
-- Copyright (C) 2020 by RStudio, PBC

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

