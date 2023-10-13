-- dashboard.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local layout = require 'modules/dashboard/layout'
local card = require 'modules/dashboard/card'
local valuebox = require 'modules/dashboard/valuebox'
local sidebar = require 'modules/dashboard/sidebar'


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
  layout = layout,
  card = card,
  valuebox = valuebox,
  sidebar = sidebar,
  document = {
    fill = dashboardParam(kLayoutFill, false),
    orientation = dashboardParam(kParamOrientation, kDefaultOrientation)
  }
}