-- validate.lua
-- Copyright (C) 2020 by RStudio, PBC

kAlignments = pandoc.List:new({ "center", "left", "right" })
kVAlignments = pandoc.List:new({"top", "center", "bottom"})

function validatedAlign(align)
  return validateInList(align, kAlignments, "alignment", "center")
end

function validatedVAlign(vAlign)
  return validateInList(vAlign, kVAlignments, "vertical alignment", "top")
end

function validateInList(value, list, attribute, default)
  if value and not list:includes(value) then
    log("Invalid " .. attribute .. " attribute value: " .. value)   
    return default
  elseif value then
    return value
  else
    return default
  end
end


function log(message)
  io.stderr:write("WARNING: " .. message)
end