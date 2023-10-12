-- valuebox.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local card = require 'modules/dashboard/card'

-- Valuebox classes
local kValueBoxClz = "valuebox"
local kValueBoxShowcaseClz = "value-box-showcase"
local kValueBoxAreaClz = "value-box-area"
local kValueBoxTitleClz = "value-box-title"
local kValueBoxValueClz = "value-box-value"

-- Valuebox attributes
local kValueBoxColor = "color"
local kValueBoxBgColor = "bg-color"
local kValueBoxFgColor = "fg-color"
local kValueBoxShowcasePosition= "showcase-position"
local kValueBoxIcon = "icon"
local kValueBoxDataAttr = {kValueBoxColor, kValueBoxBgColor, kValueBoxFgColor}
local kValueBoxShowcaseDataAttr = {kValueBoxIcon, kValueBoxShowcasePosition}


local function wrapValueBox(box, classes)
  local valueBoxClz = pandoc.List({kValueBoxClz})
  valueBoxClz:extend(classes)
  return card.makeCard(nil, {box}, valueBoxClz)
end


local function isValueBox(el) 
  return el.classes:includes(kValueBoxClz)
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
local function makeValueBox(el) 

  -- We need to actually pull apart the valuebox content
  local header = el.content[1]
  local classes = el.classes
  
  local title = {}
  local value = el.content
  local content = {}

  if header ~= nil and header.t == "Header" then
    title = header.content
    value = tslice(el.content, 2)
  end
  
  if #value > 1 then
    content = tslice(value, 2)
    value = value[1]
  end

  if pandoc.utils.type(value) ~= "table" and pandoc.utils.type(value) ~= "Blocks" then
    value = {value}
  end

  if value == nil then
    error("Value boxes must have a value -  the structure of this valuebox appears malformed.")
  end

  -- Forward attributes
  local attrs = {}
  for _i,attrName in ipairs(kValueBoxDataAttr) do
    local attrValue = el.attributes[attrName]
    if attrValue ~= nil then
      attrs['data-' .. attrName] = attrValue
    end
  end
  
  local vbDiv = pandoc.Div({}, pandoc.Attr("", {}, attrs))

  -- The valuebox icon
  local showcaseAttr = {}
  for _i,attrName in ipairs(kValueBoxShowcaseDataAttr) do
    local attrValue = el.attributes[attrName]
    if attrValue ~= nil then
      showcaseAttr['data-' .. attrName] = attrValue
    end
  end
  
  -- add the showcase
  if next(showcaseAttr) ~= nil then
    local vbShowcase = pandoc.Div({}, pandoc.Attr("", {kValueBoxShowcaseClz}, showcaseAttr))
    vbDiv.content:insert(vbShowcase)
  end  

  local vbArea = pandoc.Div({}, pandoc.Attr("", {kValueBoxAreaClz}))

  -- The valuebox title
  local vbTitle = pandoc.Div(pandoc.Plain(title), pandoc.Attr("", {kValueBoxTitleClz}))
  vbArea.content:insert(vbTitle)

  -- The valuebox value
  local vbValue = pandoc.Div(value, pandoc.Attr("", {kValueBoxValueClz}))
  vbArea.content:insert(vbValue)

  -- The rest of the contents
  if content ~= nil then
    vbArea.content:extend(content)
  end

  vbDiv.content:insert(vbArea)
  return wrapValueBox(vbDiv, classes)
end

return {
  isValueBox = isValueBox,
  makeValueBox = makeValueBox,
}


