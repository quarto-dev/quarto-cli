-- card-toolbar.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local kCardToolbarClass = "card-toolbar"

-- Attributes that specify a target (next/prev/id) and position
-- within that target
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

-- Marks whether this input panel needs to be processed 
-- (e.g. once it is determine whether panel has been placed in a card
-- or as a header or footer of another card, this attribute will be removed)
local kCardToolbarUnprocessed = "card-toolbar-unprocessed"

-- cell/chunk options to mark cell outputs as inputs
local kComponentAttr = "component"
local kContentAttr = "content"
local kComponentAttrs = pandoc.List({kComponentAttr, kContentAttr})
local kComponentAttrVal = "card-toolbar"
local kTitleAttr = "title"

local function readOptions(el)

  -- Validate that the options aren't unreasonable
  if el.attributes ~= nil then
    if el.attributes[kHeaderFor] ~= nil and el.attributes[kFooterFor] ~= nil then
      fatal("A toolbar can't appear both within a header and footer of a card or tabset. Please remove either `header-for` or `footer-for` from the inputs cell.")
    end

    local targetPosition = el.attributes[kTargetPosition]
    if targetPosition ~= nil and targetPosition ~= kTargetPositionHeader and targetPosition ~= kTargetPositionFooter then
      fatal("Invalid value target-position '" .. targetPosition .. "' for a card toolbar.")
    end
    
  end

  -- Read attributes into options
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

  -- By default, this will target appearing in the next card if no
  -- position information was specified
  if options[kTargetPosition] == nil and options[kTargetElement] == nil then
    options[kTargetPosition] = kTargetPositionHeader
    options[kTargetElement] = kTargetElementNext
  end

  if el.attributes ~= nil and el.attributes[kTitleAttr] ~= nil then
    options[kTitleAttr] = el.attributes[kTitleAttr]
  end

  return options  
end

-- Makes an input panel div
local function makeCardToolbar(contents, options) 
  local attributes = {}
  if options[kTargetElement] then
    attributes[kTargetElement] = options[kTargetElement]
  end

  if options[kTargetPosition] then
    attributes[kTargetPosition] = options[kTargetPosition]
  end

  if options[kTitleAttr] then
    attributes[kTitleAttr] = options[kTitleAttr]
  end

  -- if there is only a single cell as a child, forward its children to the top level
  if #contents == 1 and is_regular_node(contents[1], "Div") and contents[1].classes:includes("cell") then
    contents = contents[1].content
  end

  return pandoc.Div(contents, pandoc.Attr("", {kCardToolbarClass, kCardToolbarUnprocessed}, attributes))
end

-- Identifies an input panel
local function isCardToolbar(el)
  if el.attributes ~= nil and kComponentAttrs:find_if(function(attrName) 
    return el.attributes[attrName] == kComponentAttrVal
  end) then
    return true
  end

  return is_regular_node(el, "Div") and el.classes:includes(kCardToolbarClass)
end

-- Target Processing
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

local function addToTarget(toolbar, target, fnAddToHeader, fnAddToFooter)
  if targetPositionInHeader(toolbar) then
    fnAddToHeader(target, toolbar, toolbar.attributes[kTitleAttr])
  else
    fnAddToFooter(target, toolbar)
  end
end

-- Helper for tracking whether input panel is processed
local function isUnprocessed(el)
  return el.classes:includes(kCardToolbarUnprocessed)
end

local function markProcessed(el)
  el.classes = el.classes:filter(function(clz) 
    return clz ~= kCardToolbarUnprocessed
  end)
end

return {
  isCardToolbar = isCardToolbar,
  readOptions = readOptions,
  makeCardToolbar = makeCardToolbar,
  targetPrevious = targetPrevious,
  targetNext = targetNext,
  targetId = targetId,
  addToTarget = addToTarget,
  isUnprocessed = isUnprocessed,
  markProcessed = markProcessed
}