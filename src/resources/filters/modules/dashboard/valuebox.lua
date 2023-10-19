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
local kValueBoxValue = "value"
local kValueBoxTitle = "title"
local kValueBoxColor = "color"
local kValueBoxBgColor = "bg-color"
local kValueBoxFgColor = "fg-color"
local kValueBoxShowcasePosition= "showcase-position"
local kValueBoxIcon = "icon"
local kValueBoxOptions = pandoc.List({kValueBoxIcon, kValueBoxColor, kValueBoxBgColor, kValueBoxFgColor})
local kValueBoxDataAttr = {kValueBoxColor, kValueBoxBgColor, kValueBoxFgColor}
local kValueBoxShowcaseDataAttr = {kValueBoxIcon, kValueBoxShowcasePosition}
local kForwardValueFromCodeCell = pandoc.List({kValueBoxValue, kValueBoxColor, kValueBoxBgColor, kValueBoxFgColor, kValueBoxIcon })

local kComponentAttr = "component"
local kComponentValuebox = "valuebox"



local function wrapValueBox(box, classes)
  local valueBoxClz = pandoc.List({kValueBoxClz})
  valueBoxClz:extend(classes)
  return card.makeCard(nil, {box}, valueBoxClz)
end


local function isValueBox(el) 
  if el.attributes ~= nil and el.attributes[kComponentAttr] == kComponentValuebox then
    return true
  end
  return el.classes ~= nil and el.classes:includes(kValueBoxClz)
end 


local function toLines(s)
  if s:sub(-1)~="\n" then s=s.."\n" end
  return s:gmatch("(.-)\n")
end


local function parseStdOutToOptions(stdOut) 
  local options = {}
  local value = nil

  -- if it starts with `{`, treat it as jupyter output
  local firstChar = stdOut:match("^(.)")
  if firstChar == "{" then
  
    -- Remove the single quotes around the keys
    -- Replace colons with equals and single-quoted keys with unquoted keys
    local luaTableLiteral = stdOut:gsub("'([^']-)': ", "%1=")
    
    -- Load the string as a Lua table
    local parsed = load("return " .. luaTableLiteral)()

    -- the value
    value = tostring(parsed[kValueBoxValue])

    -- the options
    for k, v in pairs(parsed) do
      if kValueBoxOptions:includes(k) then
        options[k] = v
      end
    end

  else
    -- parse the stdout (look for knitr style output)
    local pendingKey = nil
    for line in toLines(stdOut) do
      if pendingKey ~= nil then
        local cleaned = line:match('%[1%] "?([^"]*)"?')
  
        if pendingKey == 'value' then
          value = cleaned
          pendingKey = nil
        else
          options[pendingKey] = cleaned
          pendingKey = nil
        end
      else
        local key = line:match("%$(.*)")
        if kForwardValueFromCodeCell:includes(key) then
          pendingKey = key
        end
      end
    end  
  end
  return options, value
end


local function valueboxContent(el)
  if el.attributes[kComponentAttr] == kComponentValuebox then 

    -- read the title from attributes, if possible
    local title = {}
    local value = el.content
    local content = {}
    local options = {}
    if el.attributes[kValueBoxTitle] ~= nil then
      title = el.attributes[kValueBoxTitle]
    end

    -- try to find stdout
    local stdOut
    _quarto.ast.walk(el, {
      Div = function(divEl)
        if divEl.classes:includes('cell-output-stdout') then
          if divEl.content[1] ~= nil and divEl.content[1].t == "CodeBlock" then
            stdOut = divEl.content[1].text
          end
        elseif divEl.classes:includes('cell-output-display') and divEl.content[1] ~= nil and divEl.content[1].t == "CodeBlock" then
          stdOut = divEl.content[1].text
        end
      end
    })

    -- Found stdout, try parsing it
    if stdOut ~= nil then
      local stdOptions, stdValue = parseStdOutToOptions(stdOut)
      options = stdOptions
      if stdValue ~= nil then
        value = stdValue
      end
    end

    return title, value, content, options
  else
    -- We need to actually pull apart the valuebox content
    -- using the basic structure
    local header = el.content[1]
    
    local title = {}
    local value = el.content
    local content = {}

    if header ~= nil and header.t == "Header" then
      title = header.content
      value = tslice(el.content, 2)
    elseif el.attributes[kValueBoxTitle] ~= nil then
      title = el.attributes[kValueBoxTitle]
    end
    
    if #value > 1 then
      content = tslice(value, 2)
      value = value[1]
    end
    return title, value, content, {}
  end
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

  -- read the title, value, and content
  local classes = el.classes
  local title, value, content, attr = valueboxContent(el)

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

  -- send any explicitly provided attributes
  for key,val in pairs(attr) do
      attrs['data-' .. key] = val
  end

  
  local vbDiv = pandoc.Div({}, pandoc.Attr("", {}, attrs))

  -- The valuebox icon
  local showcaseAttr = {}
  for _i,attrName in ipairs(kValueBoxShowcaseDataAttr) do
    local attrValue = el.attributes[attrName] or attr[attrName]
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
  if next(content) ~= nil then
    vbArea.content:extend(content)
  end

  vbDiv.content:insert(vbArea)
  return wrapValueBox(vbDiv, classes)
end

return {
  isValueBox = isValueBox,
  makeValueBox = makeValueBox,
}


