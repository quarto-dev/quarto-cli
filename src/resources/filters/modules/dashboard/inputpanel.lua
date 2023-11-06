-- inputpanel.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local kInputPanelClass = "input-panel"

local kForAttr = "for"
local kForAttrValueAbove = "above"
local kForAttrValueBelow = "below"

local kInputPanelProcess = "inputpanel-process"

local kInputPanelComponentAttr = "component"
local kInputPanelComponentAttrVal = "input-panel"

local function readOptions(el)
  local options = {}
  if el.attributes ~= nil and el.attributes[kForAttr] then
    options[kForAttr] = el.attributes[kForAttr]
  end
  return options  
end

local function makeInputPanel(contents, options) 
  local attributes = {}
  if options[kForAttr] then
    attributes[kForAttr] = options[kForAttr]
  end

  return pandoc.Div(contents, pandoc.Attr("", {kInputPanelClass, kInputPanelProcess}, attributes))
end

local function isInputPanel(el)
  if el.attributes ~= nil and el.attributes[kInputPanelComponentAttr] == kInputPanelComponentAttrVal then
    return true
  end

  return (el.t == "Div") and el.classes:includes(kInputPanelClass)
end

local function forAbove(el) 
  return el.attributes ~= nil and el.attributes[kForAttr] == kForAttrValueAbove
end

local function forBelow(el)
  return el.attributes ~= nil and el.attributes[kForAttr] == kForAttrValueBelow
end

local function isUnprocessed(el)
  return el.classes:includes(kInputPanelProcess)
end

local function markProcessed(el)
  el.classes = el.classes:filter(function(clz) 
    return clz ~= kInputPanelProcess
  end)
end

return {
  isInputPanel = isInputPanel,
  readOptions = readOptions,
  makeInputPanel = makeInputPanel,
  forAbove = forAbove,
  forBelow = forBelow,
  isUnprocessed = isUnprocessed,
  markProcessed = markProcessed
}