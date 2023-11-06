-- inputpanel.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local kInputPanelClass = "inputs"

local kHeaderFor = "header-for"
local kFooterFor = "footer-for"


-- Internal representation of the target for this set
-- of inputs
local kTargetElement = "target-element"
local kTargetElementPrevious = "previous"
local kTargetElementNext = "next"

-- Internal representation of the location to place this
-- set of inputs
local kTargetPosition = "target-position"
local kTargetPositionHeader = "header"
local kTargetPositionFooter = "footer"

local kInputPanelProcess = "inputs-process"

local kInputPanelComponentAttr = "component"
local kInputPanelContentAttr = "content"
local kInputPanelComponentAtts = pandoc.List({kInputPanelComponentAttr, kInputPanelContentAttr})
local kInputPanelComponentAttrVal = "inputs"

local function readOptions(el)
  -- TODO: Validation

  local options = {}

  if el.attributes ~= nil and el.attributes[kTargetElement] then
    options[kTargetElement] = el.attributes[kTargetElement]
  end

  if el.attributes ~= nil and el.attributes[kTargetPosition] then
    options[kTargetPosition] = el.attributes[kTargetPosition]
  end

  if el.attributes ~= nil and el.attributes[kHeaderFor] then
    options[kTargetPosition] = kTargetPositionHeader
    options[kTargetElement] = el.attributes[kHeaderFor]
  end

  if el.attributes ~= nil and el.attributes[kFooterFor] then
    options[kTargetPosition] = kTargetPositionFooter
    options[kTargetElement] = el.attributes[kFooterFor]
  end
  return options  
end

local function makeInputPanel(contents, options) 
  local attributes = {}
  if options[kTargetElement] then
    attributes[kTargetElement] = options[kTargetElement]
  end

  if options[kTargetPosition] then
    attributes[kTargetPosition] = options[kTargetPosition]
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
  return el.attributes ~= nil and el.attributes[kTargetElement] == kTargetElementPrevious
end

local function targetNext(el)
  return el.attributes ~= nil and el.attributes[kTargetElement] == kTargetElementNext
end

local function targetId(el)
  if el.attributes ~= nil and el.attributes[kTargetElement] ~= nil then
    if not targetPrevious(el) and not targetNext(el) then
      return el.attributes[kTargetElement]
    end
  end
end

local function targetPositionInHeader(el) 
  if el.attributes ~= nil and el.attributes[kTargetPosition] ~= nil then
    return el.attributes[kTargetPosition] == kTargetPositionHeader
  elseif el.attributes ~= nil then
    return el.attributes[kTargetElement] ~= kTargetElementPrevious
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