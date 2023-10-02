-- figures.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local constants = require("modules/constants")

function preventExtendedFigure(el)
  el.attr.attributes[constants.kFigExtended] = "false"
end

function forceExtendedFigure(el) 
  el.attr.attributes[constants.kFigExtended] = "true"
end

function shouldHandleExtended(el)
  return el.attr.attributes[constants.kFigExtended] ~= "false"
end

-- By default, images without captions should be
-- excluded from extended processing. 
function shouldHandleExtendedImage(el) 
  -- handle extended if there is a caption
  if el.caption and #el.caption > 0 then
    return true
  end

  -- handle extended if there are fig- attributes
  local keys = tkeys(el.attr.attributes)
  for _,k in pairs(keys) do
    if isFigAttribute(k) then
      return true
    end
  end

  -- handle extended if there is column or caption 
  -- classes
  if hasColumnClasses(el) then
    return true
  end

  -- handle extended if it was explicitly enabled
  if el.attr.attributes[constants.kFigExtended] == "true" then
    return true
  end

  -- otherwise, by default, do not handle
  return false
end
