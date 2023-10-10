-- dashboard.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local layout = require 'modules/dashboard/layout'
local card = require 'modules/dashboard/card'
local valuebox = require 'modules/dashboard/valuebox'
local sidebar = require 'modules/dashboard/sidebar'

return {
  layout = layout,
  card = card,
  valuebox = valuebox,
  sidebar = sidebar
}