-- validate.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

kAlignments = pandoc.List({ "center", "left", "right" })
kVAlignments = pandoc.List({"top", "center", "bottom"})

function validatedAlign(align, default)
  return validateInList(align, kAlignments, "alignment", default)
end

function validatedVAlign(vAlign)
  return validateInList(vAlign, kVAlignments, "vertical alignment", "top")
end

function validateInList(value, list, attribute, default)
  if value == "default" then
    return default
  elseif value and not list:includes(value) then
    -- luacov: disable
    warn("Invalid " .. attribute .. " attribute value: " .. value)
    return default
    -- luacov: enable
  else
    return value
  end
end


