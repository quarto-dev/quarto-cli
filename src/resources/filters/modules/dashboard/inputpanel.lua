-- inputpanel.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local kInputPanelClass = "inputs"

local kForAttr = "for"
local kForAttrValuePrevious = "previous"
local kForAttrValueNext = "next"

local kInAttr = "in"
local kInAttrValueHeader = "header"
local kInAttrValueFooter = "footer"

local kInputPanelProcess = "inputs-process"

local kInputPanelComponentAttr = "component"
local kInputPanelContentAttr = "content"
local kInputPanelComponentAtts = pandoc.List({kInputPanelComponentAttr, kInputPanelContentAttr})
local kInputPanelComponentAttrVal = "inputs"

local function readOptions(el)
  local options = {}

  if el.attributes ~= nil and el.attributes[kForAttr] then
    options[kForAttr] = el.attributes[kForAttr]
  end

  if el.attributes ~= nil and el.attributes[kInAttr] then
    options[kInAttr] = el.attributes[kInAttr]
  end

  return options  
end

local function makeInputPanel(contents, options) 
  local attributes = {}
  if options[kForAttr] then
    attributes[kForAttr] = options[kForAttr]
  end

  if options[kInAttr] then
    attributes[kInAttr] = options[kInAttr]
  end

  return pandoc.Div(contents, pandoc.Attr("", {kInputPanelClass, kInputPanelProcess}, attributes))
end

local function isInputPanel(el)
  if el.attributes ~= nil and kInputPanelComponentAtts:find_if(function(attrName) 
    return el.attributes[attrName] == kInputPanelComponentAttrVal
  end) then
    return true
  end

  return (el.t == "Div") and el.classes:includes(kInputPanelClass)
end

local function targetPrevious(el) 
  return el.attributes ~= nil and el.attributes[kForAttr] == kForAttrValuePrevious
end

local function targetNext(el)
  return el.attributes ~= nil and el.attributes[kForAttr] == kForAttrValueNext
end

local function targetId(el)
  if el.attributes ~= nil and el.attributes[kForAttr] ~= nil then
    if not targetPrevious(el) and not targetNext(el) then
      return el.attributes[kForAttr]
    end
  end
end

local function targetPositionInHeader(el) 
  if el.attributes ~= nil and el.attributes[kInAttr] ~= nil then
    return el.attributes[kInAttr] == kInAttrValueHeader
  elseif el.attributes ~= nil then
    return el.attributes[kForAttr] ~= kForAttrValuePrevious
  else
    return false
  end
end

local function isUnprocessed(el)
  return el.classes:includes(kInputPanelProcess)
end

local function markProcessed(el)
  el.classes = el.classes:filter(function(clz) 
    return clz ~= kInputPanelProcess
  end)
end

local function addToTarget(panel, target, fnAddToHeader, fnAddToFooter)
  if targetPositionInHeader(panel) then
    fnAddToHeader(target, panel)
  else
    fnAddToFooter(target, panel)
  end
end


return {
  isInputPanel = isInputPanel,
  readOptions = readOptions,
  makeInputPanel = makeInputPanel,
  targetPrevious = targetPrevious,
  targetNext = targetNext,
  targetId = targetId,
  addToTarget = addToTarget,
  isUnprocessed = isUnprocessed,
  markProcessed = markProcessed
}