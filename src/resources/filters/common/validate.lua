-- validate.lua
-- Copyright (C) 2020 by RStudio, PBC

kAlignments = pandoc.List:new({ "center", "left", "right" })

function validatedAlign(align)
  if not kAlignments:includes(align) then
    log("Invalid alignment attribute: " .. align)
    return "center"
  else
    return align
  end
end

function log(message)
  io.stderr:write("WARNING: " .. message)
end