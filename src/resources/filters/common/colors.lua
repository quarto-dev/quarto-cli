-- colors.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- These colors are used as background colors with an opacity of 0.75
kColorUnknown = "909090"
kColorNote = "0758E5"
kColorImportant = "CC1914"
kColorWarning = "EB9113"
kColorTip = "00A047"
kColorCaution = "FC5300"

-- these colors are used with no-opacity
kColorUnknownFrame = "acacac"
kColorNoteFrame = "4582ec"
kColorImportantFrame = "d9534f"
kColorWarningFrame = "f0ad4e"
kColorTipFrame = "02b875"
kColorCautionFrame = "fd7e14"

kBackgroundColorUnknown = "e6e6e6"
kBackgroundColorNote = "dae6fb"
kBackgroundColorImportant = "f7dddc"
kBackgroundColorWarning = "fcefdc"
kBackgroundColorTip = "ccf1e3"
kBackgroundColorCaution = "ffe5d0"

function latexXColor(color) 
  -- remove any hash at the front
  color = pandoc.utils.stringify(color)
  color = color:gsub("#","")

  local hexCount = 0
  for match in color:gmatch "%x%x" do
    hexCount = hexCount + 1
  end

  if hexCount == 3 then
    -- this is a hex color
    return "{HTML}{" .. color .. "}"
  else
    -- otherwise treat it as a named color
    -- and hope for the best
    return '{named}{' .. color .. '}' 
  end
end

-- converts a hex string to a RGB
function hextoRgb(hex)
  -- remove any leading #
  hex = hex:gsub("#","")

  -- convert to 
  return {
    red = tonumber("0x"..hex:sub(1,2)), 
    green = tonumber("0x"..hex:sub(3,4)), 
    blue = tonumber("0x"..hex:sub(5,6))
  }
end

