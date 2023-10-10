-- card.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- Card classes
local kCardClass = "card"
local kCardHeaderClass = "card-header"
local kCardBodyClass = "card-body"

-- Tabset classes
local kTabsetClass = "tabset"
local kTabClass = "tab"

-- Implicit Card classes, these mean that this is a card
-- even if it isn't specified
local kCardClz = pandoc.List({kCardClass, kTabsetClass})
local kCardBodyClz = pandoc.List({kCardBodyClass, kTabClass})

-- Card classes that are forwarded to attributes
local kExpandable = "expandable"
local kCardClzToAttr = pandoc.List({kExpandable})

-- Card Attributes 
local kPadding = "padding"
local kHeight = "height"
local kMinHeight = "min-height"
local kMaxHeight = "max-height"
local kTitle = "title"

-- Card explicit attributes
local kCardAttributes = pandoc.List({kTitle, kPadding, kHeight, kMinHeight, kMaxHeight})

-- Card Body Explicit Attributes
local kCardBodyAttributes = pandoc.List({kTitle, kHeight, kMinHeight, kMaxHeight})

-- pop images out of paragraphs to the top level
-- this is necessary to ensure things like `object-fit`
-- will work with images (because they're directly contained)
-- in a constraining element
local function popImagePara(el)
  if el.t == "Para" and #el.content == 1 then
    return el.content
  else
    return _quarto.ast.walk(el, {
      Para = function(para)
        if #para.content == 1 then
          return para.content[1]
        end
        return para
      end
    })  
  end
end

local function isCard(el) 
  return el.t == "Div" and el.classes:find_if(function(class) 
    return kCardClz:includes(class)
  end) 
end

local function isCardBody(el) 
  return el.t == "Div" and el.classes:find_if(function(class) 
    return kCardBodyClz:includes(class)
  end) 
end

local function isLiteralCard(el)
  -- it must be a div
  if el.t ~= "Div" then
    return false
  end

  -- it must have a header and body
  local cardHeader = el.content[1]
  local cardBody = el.content[2]
  local hasHeader = cardHeader ~= nil and cardHeader.classes ~= nil and cardHeader.classes:includes(kCardHeaderClass)
  local hasBody = cardBody ~= nil and cardBody.classes ~= nil and cardBody.classes:includes(kCardBodyClass)
  if hasHeader and hasBody then
    return true
  end

  return false
end


local function readCardOptions(el) 
  local options = {}
  for _i, v in ipairs(kCardClzToAttr) do
    if el.classes:includes(v) then
      options[v] = true
    end
  end

  for _i, v in ipairs(kCardAttributes) do
    if el.attr.attributes[v] ~= nil then
      options[v] = el.attr.attributes[v]
    end
  end

  local clz = el.classes:filter(function(class)
    return not kCardClzToAttr:includes(class)
  end)

  return options, clz
end

local function resolveCardHeader(title, options) 
  if title ~= nil then
    if pandoc.utils.type(title) == "table" and #title > 0 then
      return pandoc.Div(title, pandoc.Attr("", {kCardHeaderClass}))
    elseif title.t == "Header" then
      local titleText = title.content
      if #titleText == 0 then
        titleText = title.attr.attributes[kTitle] 
      end
      return pandoc.Div(titleText, pandoc.Attr("", {kCardHeaderClass}))
    elseif options[kTitle] ~= nil then
      return pandoc.Div(options[kTitle], pandoc.Attr("", {kCardHeaderClass}))
    end
  else
    if options[kTitle] ~= nil then
      return pandoc.Div(pandoc.Plain(options[kTitle]), pandoc.Attr("", {kCardHeaderClass}))
    end
  end
end

-- Group the contents of the card into a body
-- (anything not in an explicit card-body will be grouped in 
--  an card-body with other contiguous non-card-body elements)
local function resolveCardBodies(contents)
  local result = pandoc.List()
  local bodyContentEls = pandoc.List()
  local function flushBodyContentEls()
    if #bodyContentEls > 0 then

      local contentDiv = pandoc.Div({}, pandoc.Attr("", {kCardBodyClass}))

      -- forward attributes from the first child into the parent body
      for k, v in pairs(bodyContentEls[1].attributes) do
        if kCardBodyAttributes:includes(k) then
          contentDiv.attr.attributes["data-" .. k] = pandoc.utils.stringify(v)
          bodyContentEls[1].attributes[k] = nil
        end
      end
      contentDiv.content:extend(bodyContentEls)
      result:insert(contentDiv)
    end
    bodyContentEls = pandoc.List()
  end
  local function addBodyContentEl(el)
    local popped = popImagePara(el)
    bodyContentEls:insert(popped)
  end

  for _i,v in ipairs(contents) do
    if isCardBody(v) then
      flushBodyContentEls()

      -- ensure this is marked as a card
      if not v.classes:includes(kCardBodyClass) then
        v.classes:insert(kCardBodyClass)
      end

      -- remove the tab class as this is now a resolved card body
      v.classes = v.classes:filter(function(class) return class ~= kTabClass end)

      -- forward our known attributes into data attributes
      for k, val in pairs(v.attr.attributes) do
        if kCardBodyAttributes:includes(k) then
          v.attr.attributes["data-" .. k] = pandoc.utils.stringify(val)
          v.attr.attributes[k] = nil
        end
      end
      local popped = popImagePara(v);
      result:insert(popped)

    else
      addBodyContentEl(v)
    end    
  end
  flushBodyContentEls()
  
  return result
end

-- title: string
-- contents: table
-- classes: table
-- Card DOM structure
-- .card[scrollable, max-height, min-height, full-screen(true, false), full-bleed?,]
--   .card-header
--   .card-body[max-height, min-height]
local function makeCard(title, contents, classes, options)  

  -- compute the card contents
  local cardContents = pandoc.List({})

  -- the card header
  local cardHeader = resolveCardHeader(title, options)
  if cardHeader ~= nil then
    cardContents:insert(cardHeader)  
  end

  -- compute the card body(ies)
  local cardBodies = resolveCardBodies(contents)
  cardContents:extend(cardBodies)
  
  -- add outer classes
  local clz = pandoc.List({kCardClass})
  if classes then
    clz:extend(classes)
  end

  -- forward options onto attributes
  local attributes = {}
  options = options or {}  
  for k,v in pairs(options) do
    attributes['data-' .. k] = pandoc.utils.stringify(v)
  end
  
  return pandoc.Div(cardContents, pandoc.Attr("", clz, attributes))
end

return {
  isCard = isCard,
  isLiteralCard = isLiteralCard,
  makeCard = makeCard,
  readCardOptions = readCardOptions,
}