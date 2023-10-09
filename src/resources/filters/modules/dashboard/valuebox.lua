-- valuebox.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local card = require 'modules/dashboard/card'

-- Valuebox classes
local kValueBoxClz = "valuebox"
local kValueBoxShowcaseClz = "value-box-showcase"
local kValueBoxAreaClz = "value-box-area"
local kValueBoxTitleClz = "value-box-title"
local kValueBoxValueClz = "value-box-value"

local function htmlBsImage(icon)
  return pandoc.RawInline("html", '<i class="bi bi-' .. icon .. '"></i>')
end

local function showcaseClz(showcase)           
  -- top-right
  -- left-center
  -- bottom
  if showcase == nil then
    showcase = 'left-center'
  end
  return 'showcase-' .. showcase
end

local function wrapValueBox(box, showcase, classes)
  local valueBoxClz = pandoc.List({kValueBoxClz, showcaseClz(showcase)})
  valueBoxClz:extend(classes)
  return card.makeCard(nil, {box}, valueBoxClz)
end


-- Make a valuebox
-- ValueBox DOM structure
-- .card .value-box[showcase(left-center,top-right,bottom), color(scss name, actual value)]
--   .value-box-grid
--     .value-box-showcase
--     .value-box-area
--       .value-box-title
--       .value-box-value
--        other content
--  attributes
--    full-screen
--    scrolling
--    full-bleed

local function makeValueBox(title, value, icon, content, showcase, classes) 
  if value == nil then
    error("Value boxes must have a value")
  end

  local vbDiv = pandoc.Div({}, pandoc.Attr("", {}))

  -- The valuebox icon
  if icon ~= nil then
    local bsImage = htmlBsImage(icon)
    local vbShowcase = pandoc.Div({bsImage}, pandoc.Attr("", {kValueBoxShowcaseClz}))
    vbDiv.content:insert(vbShowcase)
  end

  local vbArea = pandoc.Div({}, pandoc.Attr("", {kValueBoxAreaClz}))
  

  -- The valuebox title
  local vbTitle = pandoc.Div(title, pandoc.Attr("", {kValueBoxTitleClz}))
  vbArea.content:insert(vbTitle)

  -- The valuebox value
  local vbValue = pandoc.Div(value, pandoc.Attr("", {kValueBoxValueClz}))
  vbArea.content:insert(vbValue)

  -- The rest of the contents
  if content ~= nil then
    vbArea.content:extend(content)
  end

  vbDiv.content:insert(vbArea)
  return wrapValueBox(vbDiv, showcase, classes)
end

return {
  makeValueBox = makeValueBox,
  classes = {
    valuebox = kValueBoxClz
  }
}


