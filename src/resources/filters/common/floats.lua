-- floats.lua
-- Copyright (C) 2023 Posit Software, PBC

-- constants for float attributes
local kFloatAlignSuffix = "-align"
-- local kEnvSuffix = "-env"
-- local kAltSuffix = "-alt"
-- local kPosSuffix = "-pos"
-- local kCapSuffix = "-cap"
-- local kScapSuffix = "-scap"
-- local kResizeWidth = "resize.width"
-- local kResizeHeight = "resize.height"

function align_attribute(float)
  local prefix = refType(float.identifier)
  local attr_key = prefix .. kFloatAlignSuffix
  local default = pandoc.utils.stringify(
    param(attr_key, pandoc.Str("default"))
  )
  local align = attribute(float, attr_key, default)
  if align == "default" then
    align = default
  end
  return validatedAlign(align, "center")
end