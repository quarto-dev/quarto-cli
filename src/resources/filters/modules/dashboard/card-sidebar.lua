-- card-sidebar.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local kCardSidebarClass = "card-sidebar"

-- Internal representation of the target for this set
-- of inputs
local kTarget = "target"
local kTargetOut = "data-target"
local kTargetAttr = pandoc.List({kTarget, kTargetOut})
local kTargetElementPrevious = "previous"
local kTargetElementNext = "next"

local kWidthAttr = "width";
local kWidthOutAttr = "data-width";

-- Internal representation of the location to place this
-- set of inputs
local kTargetPosition = "position"
local kTargetPositionLeft = "left"
local kTargetPositionRight = "right"

-- Marks whether this input panel needs to be processed 
-- (e.g. once it is determine whether panel has been placed in a card
-- or as a header or footer of another card, this attribute will be removed)
local kCardSidebarUnprocessed = "card-sidebar-unprocessed"

-- cell/chunk options to mark cell outputs as inputs
local kComponentAttr = "component"
local kContentAttr = "content"
local kComponentAttrs = pandoc.List({kComponentAttr, kContentAttr})
local kComponentAttrVal = "card-sidebar"

local function readOptions(el)

  -- Validate that the options aren't unreasonable
  if el.attributes ~= nil then

    local targetPosition = el.attributes[kTargetPosition]
    if targetPosition ~= nil and targetPosition ~= kTargetPositionLeft and targetPosition ~= kTargetPositionRight then
      fatal("Invalid value target-position '" .. targetPosition .. "' for a card sidebar.")
    end
    
  end

  -- Read attributes into options
  local options = {}

  if el.attributes ~= nil and el.attributes[kTarget] ~= nil then
    options[kTarget] = el.attributes[kTarget]
  else 
    options[kTarget] = kTargetElementNext
  end

  if el.attributes ~= nil and el.attributes[kWidthAttr] ~= nil then
    options[kWidthAttr] = el.attributes[kWidthAttr]
  end

  if el.attributes ~= nil and el.attributes[kTargetPosition] ~= nil then
    options[kTargetPosition] = el.attributes[kTargetPosition]
  else
    if options[kTarget] == kTargetElementPrevious then
      options[kTargetPosition] = kTargetPositionRight
    else
      options[kTargetPosition] = kTargetPositionLeft
    end
  end
  return options  
end

-- Makes an input panel div
local function makeCardSidebar(contents, options) 
  local attributes = {}
  if options[kTarget] ~= nil then
    attributes[kTargetOut] = options[kTarget]
  end

  if options[kTargetPosition] ~= nil then
    attributes[kTargetPosition] = options[kTargetPosition]
  end

  if options[kWidthAttr] ~= nil then
    attributes[kWidthOutAttr] = options[kWidthAttr]
  end

  -- if there is only a single cell as a child, forward its children to the top level
  if #contents == 1 and is_regular_node(contents[1], "Div") and contents[1].classes:includes("cell") then
    contents = contents[1].content
  end

  return pandoc.Div(contents, pandoc.Attr("", {kCardSidebarClass, kCardSidebarUnprocessed}, attributes))
end

-- Identifies an input panel
local function isCardSidebar(el)
  if el.attributes ~= nil and kComponentAttrs:find_if(function(attrName) 
    return el.attributes[attrName] == kComponentAttrVal
  end) then
    return true
  end
  return is_regular_node(el, "Div") and el.classes:includes(kCardSidebarClass)
end

-- Target Processing
local function targetPrevious(el) 
  return el.attributes ~= nil and kTargetAttr:find_if(function(attrName)
    return el.attributes[attrName] == kTargetElementPrevious
  end)
end

local function targetNext(el)
  return el.attributes ~= nil and kTargetAttr:find_if(function(attrName)
    return el.attributes[attrName] == kTargetElementNext
  end)
end

local function targetId(el)
  if el.attributes ~= nil and el.attributes[kTargetOut] ~= nil then
    if not targetPrevious(el) and not targetNext(el) then
      return el.attributes[kTargetOut]
    end
  end
end

local function addToTarget(sidebar, target, fnAddToBody)
  fnAddToBody(target, sidebar)
end

-- Helper for tracking whether input panel is processed
local function isUnprocessed(el)
  return el.classes:includes(kCardSidebarUnprocessed)
end

local function markProcessed(el)
  el.classes = el.classes:filter(function(clz) 
    return clz ~= kCardSidebarUnprocessed
  end)
end

return {
  isCardSidebar = isCardSidebar,
  readOptions = readOptions,
  makeCardSidebar = makeCardSidebar,
  targetPrevious = targetPrevious,
  targetNext = targetNext,
  targetId = targetId,
  addToTarget = addToTarget,
  isUnprocessed = isUnprocessed,
  markProcessed = markProcessed
}