-- page.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
local document = require "modules/dashboard/document"
local layout = require "modules/dashboard/layout"

local kPageClass = "dashboard-page"

local kOrientationAttr = "orientation"
local kOrientationRowsClass = "rows"
local kOrientationColumnsClass = "columns"

local kPageAttr = "data-title"

local function readOptions(el)

  local orientation = el.attributes[kOrientationAttr] or document.orientation;
  if el.classes ~= nil and el.classes:includes(kOrientationColumnsClass) then
    orientation = kOrientationColumnsClass
  elseif el.classes ~= nil and el.classes:includes(kOrientationRowsClass) then    
    orientation = kOrientationRowsClass
  end

  return {
    [kOrientationAttr] = orientation
  }
end

local function makePage(headerEl, contents, options) 

  local title = pandoc.utils.stringify(headerEl)
  local classes = pandoc.List({kPageClass})
  local attr = {}
  if title ~= nil then
    attr[kPageAttr] = title
  end
  
  -- forward options onto attributes
  for k, v in pairs(options) do
    attr['data-' .. k] = v
  end

  local tabContentsOrientation = options[kOrientationAttr];
  local pageContainerEl = layout.orientContents(contents, tabContentsOrientation, {})
  local pageDiv = pandoc.Div(pageContainerEl, pandoc.Attr("", classes, attr))
  
  return pageDiv, options[kOrientationAttr]
end


return {
  readOptions = readOptions,
  makePage = makePage
}