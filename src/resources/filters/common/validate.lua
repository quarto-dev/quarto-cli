-- validate.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function validatedAlign(align, default)
  local kAlignments = pandoc.List({ "center", "left", "right" })
  return validateInList(align, kAlignments, "alignment", default)
end

function validatedVAlign(vAlign)
  local kVAlignments = pandoc.List({"top", "top-baseline", "center", "bottom"})
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


