-- document.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- param name
local kParamKey = "dashboard"

-- Layout param
local kLayoutScrolling = "scrolling"

-- Orientation param
local kParamOrientation = "orientation"
local kDefaultOrientation = kOrientationRows


local function dashboardParam(name, default) 
  local dashboardParams = param(kParamKey, {})
  return dashboardParams[name] or default
end


return {
  scrolling = dashboardParam(kLayoutScrolling, false),
  orientation = dashboardParam(kParamOrientation, kDefaultOrientation)
}
