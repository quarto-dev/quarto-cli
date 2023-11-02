-- layout.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local document = require "modules/dashboard/document"

-- Layout classes
local kRowsClass = "rows"
local kColumnsClass = "columns"
local kLayoutClz = pandoc.List({kRowsClass, kColumnsClass})

-- Layout options
local kLayoutHeight = "height"
local kLayoutWidth = "width"
local kLayout = "layout"         -- fill, flow, nil

-- Layout values
local kLayoutFill = "fill"
local kLayoutFlow = "flow"

-- Page level data
local kOrientationRows = "rows"
local kOrientationColumns = "columns"

local kOptionClasses = "classes"



local function isRowContainer(el)
  return el.classes ~= nil and el.classes:includes(kRowsClass)
end

local function isColumnContainer(el)
  return el.classes ~= nil and el.classes:includes(kColumnsClass)
end

local function isRowOrColumnContainer(el) 
  return isRowContainer(el) or isColumnContainer(el)
end

local function validateLayout(options)
  if options[kLayout] ~= nil then
    if options[kLayout] ~= kLayoutFill and options[kLayout] ~= kLayoutFlow then
      error("Layout must be either fill or flow.")
    end
  end
end

local function readOptions(el)

  local options = {}
  local clz = el.attr.classes;

  -- Read classes to determine fill or flow (or auto if omitted)
  if clz:includes(kLayoutFill) then
    options[kLayout] = kLayoutFill
  elseif clz:includes(kLayoutFlow) then
    options[kLayout] = kLayoutFlow;
  end

  -- Read explicit height or width
  options[kLayoutHeight] = el.attributes[kLayoutHeight];  
  options[kLayoutWidth] = el.attributes[kLayoutWidth];

  -- Does the column have a sidebar class decorating it?
  local classes = clz:filter(function(class)
    return not kLayoutClz:includes(class)
  end)
  options[kOptionClasses] = classes

  return options;
end

local function makeOptions(scrolling) 
  local options = {}
  if scrolling == true then
    options[kLayout] = kLayoutFlow
  else
    options[kLayout] = kLayoutFill
  end
  return options;
end

local function makeColumnContainer(content, options)
  validateLayout(options)


  -- forward the options onto attributes
  local attributes = {}
  for k,v in pairs(options) do
    if k ~= kOptionClasses then
      attributes["data-" .. k] = v
    end
  end

  -- the classes
  local classes = pandoc.List({kColumnsClass})
  if options[kOptionClasses] ~= nil then
    classes:extend(options[kOptionClasses])
  end

  local result = pandoc.Div(content, pandoc.Attr("", classes, attributes))
  return result
end

local function makeRowContainer(content, options) 
  
  -- rows can't have width
  validateLayout(options)

  -- forward attributes along
  local attributes = {}
  for k,v in pairs(options) do
    if k ~= kOptionClasses then
      attributes["data-" .. k] = v
    end
  end

  -- the classes
  local classes = pandoc.List({kRowsClass})
  if options[kOptionClasses] ~= nil then
    classes:extend(options[kOptionClasses])
  end

  return pandoc.Div(content, pandoc.Attr("", classes, attributes))
end

local currentOrientation = document.orientation

local function rotatedOrientation() 
  if currentOrientation == kOrientationRows then
    return kOrientationColumns
  else
    return kOrientationRows
  end 
end

local function orientation() 
  return currentOrientation
end

local function setOrientation(o) 
  currentOrientation = o
end

local function orientContents(contents, toOrientation, options)
  if toOrientation == kOrientationColumns then
    currentOrientation = toOrientation
    return makeColumnContainer(contents, options)
  else
    currentOrientation = toOrientation
    return makeRowContainer(contents, options)
  end
end



return {
  isRowOrColumnContainer = isRowOrColumnContainer,
  isRowContainer = isRowContainer,
  isColumnContainer = isColumnContainer,
  currentOrientation = orientation,
  rotatedOrientation = rotatedOrientation,
  setOrientation = setOrientation,
  orientContents = orientContents,
  readOptions = readOptions,
  makeOptions = makeOptions,
  orientations = {
    columns = kOrientationColumns,
    rows = kOrientationRows
  }
}