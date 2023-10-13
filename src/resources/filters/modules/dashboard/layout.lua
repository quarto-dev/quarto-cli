-- layout.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- Layout classes
local kRowsClass = "rows"
local kColumnsClass = "columns"

-- Layout options
local kLayoutHeight = "height"
local kLayoutWidth = "width"
local kLayout = "layout"         -- fill, flow, nil

-- Layout values
local kLayoutFill = "fill"
local kLayoutFlow = "flow"


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

  return options;
end

local function makeOptions(filling) 
  local options = {}
  if filling == true then
    options[kLayout] = kLayoutFill
  else
    options[kLayout] = kLayoutFlow
  end
  return options;
end

local function makeRows(content, options)

  -- rows can't have width
  validateLayout(options)
  if options[kLayoutWidth] ~= nil then
    error("Rows are not allowed to specify their width - they always fill their container.")
  end

  -- forward the options onto attributes
  local attributes = {}
  for k,v in pairs(options) do
    attributes["data-" .. k] = v
  end

  return pandoc.Div(content, pandoc.Attr("", {kRowsClass}, attributes))
end

local function makeCols(content, options) 
  
  -- cols can't have height
  validateLayout(options)
  if options[kLayoutHeight] ~= nil then
    error("Rows are not allowed to specify their width - they always fill their container.")
  end

  -- forward attributes along
  local attributes = {}
  for k,v in pairs(options) do
    attributes["data-" .. k] = v
  end

  return pandoc.Div(content, pandoc.Attr("", {kColumnsClass}, attributes))
end


return {
  makeRows = makeRows,
  makeCols = makeCols,
  readOptions = readOptions,
  makeOptions = makeOptions
}