-- page.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
local document = require "modules/dashboard/document"
local sidebar = require "modules/dashboard/sidebar"
local toolbar = require "modules/dashboard/toolbar"
local layout = require "modules/dashboard/layout"

local kPageClass = "dashboard-page"

local kOrientationAttr = "orientation"
-- TODO: Convert this to use orientation="rows|columns" like pages
local kOrientationRowsClass = "rows"
local kOrientationColumnsClass = "columns"

local kPageAttr = "data-title"
local kScrollingAttr = "scrolling"

local function readOptions(el)
  local orientation = el.attributes[kOrientationAttr] or document.orientation;
  if el.classes ~= nil and el.classes:includes(kOrientationColumnsClass) then
    orientation = kOrientationColumnsClass
  elseif el.classes ~= nil and el.classes:includes(kOrientationRowsClass) then    
    orientation = kOrientationRowsClass
  end

  local options = {
    [kOrientationAttr] = orientation,
    [kScrollingAttr] = el.attributes[kScrollingAttr]
  }

  return options
end

local function makePage(id, headerEl, contents, options) 

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

  -- Infer orientation by seeing 'sidebar' on a row
  if sidebar.hasChildSidebar(pandoc.Div(contents)) then
    tabContentsOrientation = layout.orientations.columns
  elseif toolbar.hasChildToolbar(pandoc.Div(contents)) then
    tabContentsOrientation = layout.orientations.rows
  end

  local pageContainerEl = layout.orientContents(contents, tabContentsOrientation, {})
  local pageDiv = pandoc.Div(pageContainerEl, pandoc.Attr(id, classes, attr))
  
  return pageDiv, options[kOrientationAttr]
end


return {
  readOptions = readOptions,
  makePage = makePage
}