-- document.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- param name
local kParamKey = "dashboard"

-- Layout param
local kLayoutFill = "fill"

-- Orientation param
local kParamOrientation = "orientation"
local kDefaultOrientation = kOrientationRows


local function dashboardParam(name, default) 
  local dashboardParams = param(kParamKey, {})
  return dashboardParams[name] or default
end


return {
  fill = dashboardParam(kLayoutFill, true),
  orientation = dashboardParam(kParamOrientation, kDefaultOrientation)
}
