-- card.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
local utils = require "modules/dashboard/utils"

-- Card classes
local kCardClass = "card"
local kCardHeaderClass = "card-header"
local kCardBodyClass = "card-body"
local kCardFooterClass = "card-footer"

-- Cell classes
local kCellClass = "cell"
local kFlowClass = "flow"
local kFillClass = "fill"

-- Implicit Card classes, these mean that this is a card
-- even if it isn't specified
local kCardClz = pandoc.List({kCardClass})
local kCardBodyClz = pandoc.List({kCardBodyClass, kCellClass})
local kCardHeaderClz = pandoc.List({kCardHeaderClass})

-- Card classes that are forwarded to attributes
local kExpandable = "expandable"
local kCardClzToAttr = pandoc.List({kExpandable})

-- Card Attributes 
local kPadding = "padding"
local kHeight = "height"
local kWidth = "width"
local kMinHeight = "min-height"
local kMaxHeight = "max-height"
local kTitle = "title"
local kFill = "fill"

-- Card explicit attributes
local kCardAttributes = pandoc.List({kTitle, kPadding, kHeight, kWidth, kMinHeight, kMaxHeight, kExpandable, kFill})

-- Card Body Explicit Attributes
local kCardBodyAttributes = pandoc.List({kTitle, kHeight, kMinHeight, kMaxHeight})

-- Card Options
local kForceHeader = "force-header";

-- pop images out of paragraphs to the top level
-- this is necessary to ensure things like `object-fit`
-- will work with images (because they're directly contained)
-- in a constraining element
local function processCardBodyContent(el, headingOffset)
  if el.t == "Para" and #el.content == 1 then
    return pandoc.Plain(el.content)
  elseif el.t == "Header" then
    local level = math.min(el.level + headingOffset, 6)
    local headerClz = "h" .. level;
    return pandoc.Div(el.content, pandoc.Attr("", {headerClz}))
  else
    local result = _quarto.ast.walk(el, {
      Para = function(para)
        if #para.content == 1 then
          return para.content[1]
        end
        return para
      end,
    })  
    return result
  end
end

local function hasCardDecoration(el)
  return el.classes ~= nil and el.classes:find_if(function(class) 
    return kCardClz:includes(class)
  end) 
end

local function isCard(el) 
  return is_regular_node(el, "Div") and hasCardDecoration(el)
end

local function isCardBody(el) 
  return is_regular_node(el, "Div") and el.classes ~= nil and el.classes:find_if(function(class) 
    return kCardBodyClz:includes(class)
  end) 
end
local function isCardFooter(el)
  return el.t == "BlockQuote" or (is_regular_node(el, "Div") and el.classes:includes(kCardFooterClass))
end

local function isCardHeader(el)
  return is_regular_node(el, "Div") and el.classes ~= nil and el.classes:find_if(function(class) 
    return kCardHeaderClz:includes(class)
  end) 
end

local function hasRealLookingContent(contents)
  -- Inspect the loose content and don't make cards out of things that don't look cardish
  local hasReal = false
  for _i, v in ipairs(contents) do
    -- This looks like shiny pre-rendered stuff, just ignore it
    if v.t == "Para" and pandoc.utils.stringify(v):match('^preserve%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x.*') then
    elseif v.t == "RawBlock" then
    else
      hasReal = true
    end
  end
  return hasReal or #contents == 0
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


local function readOptions(el) 
  local options = {}
  
  if el.classes ~= nil then
    for _i, v in ipairs(kCardClzToAttr) do
      if el.classes:includes(v) then
        options[v] = true
      end
    end

    if el.classes:includes(kFlowClass) then
      options[kFill] = false
    elseif el.classes:includes(kFillClass) then
      options[kFill] = true
    end
  end

  if el.attributes ~= nil then
    for _i, v in ipairs(kCardAttributes) do
      if el.attributes[v] ~= nil then
        options[v] = el.attributes[v]
      end
    end
  end

  local clz = pandoc.List()
  if el.classes ~= nil then
    clz = el.classes:filter(function(class)
      return not kCardClzToAttr:includes(class)
    end)  
  end
  
  return options, clz
end

local function resolveCardHeader(options) 
  if options and options[kTitle] ~= nil then
    -- The title is being provided as option
    return pandoc.Div(pandoc.Plain(string_to_quarto_ast_inlines(options[kTitle])), pandoc.Attr("", {kCardHeaderClass}))
  elseif options ~= nil and options[kForceHeader] then
    -- Couldn't find a title, but force the header into place
    return pandoc.Div(pandoc.Plain(""), pandoc.Attr("", {kCardHeaderClass}))
  end
end

local function resolveCardFooter(cardFooterEls) 
  if cardFooterEls and #cardFooterEls > 0 then
    return pandoc.Div(cardFooterEls, pandoc.Attr("", {kCardFooterClass}))
  end
end

-- Group the contents of the card into a body
-- (anything not in an explicit card-body will be grouped in 
--  an card-body with other contiguous non-card-body elements)
local function resolveCardBodies(contents)
  local bodyContentEls = pandoc.List()
  local footerContentEls = pandoc.List()
  local headerContentEls = pandoc.List()

  local collectedBodyEls = pandoc.List() 
  local function flushCollectedBodyContentEls()
    if #collectedBodyEls > 0 then

      local contentDiv = pandoc.Div({}, pandoc.Attr("", {kCardBodyClass}))

      -- forward attributes from the first child into the parent body
      if collectedBodyEls[1].attributes then
        for k, v in pairs(collectedBodyEls[1].attributes) do
          if kCardBodyAttributes:includes(k) then
            contentDiv.attr.attributes["data-" .. k] = pandoc.utils.stringify(v)
            collectedBodyEls[1].attributes[k] = nil
          end
        end
      end

      -- If the card doesn't have `real content`, just pile it into the previous 
      -- body (or leave it hanging around to go into the next code body)
      local hasRealContent = hasRealLookingContent(collectedBodyEls)
      if hasRealContent then
        contentDiv.content:extend(collectedBodyEls)
        bodyContentEls:insert(contentDiv)
        collectedBodyEls = pandoc.List()
      else
        local prevDiv = bodyContentEls[#bodyContentEls]
        if prevDiv ~= nil then
          prevDiv.content:extend(collectedBodyEls)
          collectedBodyEls = pandoc.List()
        end
      end
    end
  end
  local function collectBodyContentEl(el, headingOffset)
    local processed = processCardBodyContent(el, headingOffset)
    collectedBodyEls:insert(processed)
  end

  -- ensure that contents is a list
  if pandoc.utils.type(contents) == "table" and contents[1] == nil then
    contents = {contents}
  end

  -- compute an offset to use when processing cell contents
  local baseHeadingLevel = 10000
  if contents ~= nil then
    _quarto.ast.walk(pandoc.Pandoc(contents), {
      Header = function(el)
        baseHeadingLevel = math.min(el.level, baseHeadingLevel)
      end
    })
  end
  local headingOffset = math.max(math.min(4 - baseHeadingLevel, 10000), 0)

  for _i,v in ipairs(contents) do

    if isCard(v) then
      flushCollectedBodyContentEls()

      -- this is a card that is nested inside a card.
      -- extract its contents and just merge them into the 
      -- appropriate places within this card
      local cardContentEls = v.content
      local title = nil
      if v.content[1] ~= nil and isCardHeader(v.content[1]) then
        cardContentEls = tslice(v.content, 2)
        title = pandoc.utils.stringify(v.content[1].content) or ""
      end
      

      local cardBodyEls, cardHeaderEls, cardFooterEls = resolveCardBodies(cardContentEls)
      if title ~= nil and next(cardBodyEls) ~= nil then
        cardBodyEls[1].attributes['data-title'] = title
      end
      
      if cardBodyEls ~= nil then 
        bodyContentEls:extend(cardBodyEls)
      end

      if cardFooterEls ~= nil then
        footerContentEls:extend(cardFooterEls)
      end

      if cardHeaderEls ~= nil then
        headerContentEls:extend(cardHeaderEls)
      end

    elseif isCardBody(v) then
      flushCollectedBodyContentEls()

      -- ensure this is marked as a card
      if not v.classes:includes(kCardBodyClass) then
        v.classes:insert(kCardBodyClass)
      end

      -- forward our known attributes into data attributes
      for k, val in pairs(v.attr.attributes) do
        if kCardBodyAttributes:includes(k) then
          v.attr.attributes["data-" .. k] = pandoc.utils.stringify(val)
          v.attr.attributes[k] = nil
        end
      end
      local processed = processCardBodyContent(v, headingOffset);
      bodyContentEls:insert(processed)

    elseif isCardFooter(v) then
      footerContentEls:extend(v.content)
    elseif isCardHeader(v) then
      headerContentEls:extend(v.content)
    else
      collectBodyContentEl(v, headingOffset)
    end    
  end
  flushCollectedBodyContentEls()
  
  return bodyContentEls, headerContentEls, footerContentEls
end

-- title: string
-- contents: table
-- classes: table
-- Card DOM structure
-- .card[scrollable, max-height, min-height, full-screen(true, false), full-bleed?,]
--   .card-header
--   .card-body[max-height, min-height]
local function makeCard(contents, classes, options)  

  -- Inspect the loose content and don't make cards out of things that don't look cardish
  local hasRealContent = hasRealLookingContent(contents)
  if not hasRealContent then
    return nil
  end

  -- compute the card contents
  local cardContents = pandoc.List({})

  -- compute the card body(ies)
  local cardBodyEls, cardHeaderEls, cardFooterEls = resolveCardBodies(contents)

  -- the card header
  local cardHeader = resolveCardHeader(options)
  if cardHeaderEls ~= nil and #cardHeaderEls > 0 then
    if cardHeader ~= nil then
      cardHeader.content:extend(cardHeaderEls)
    else
      cardHeader = pandoc.Div(cardHeaderEls, pandoc.Attr("", {kCardHeaderClass}))
    end
  end
  if cardHeader ~= nil then
    cardContents:insert(cardHeader)  
  end

  -- the body
  cardContents:extend(cardBodyEls)

  -- compute any card footers
  local cardFooter = resolveCardFooter(cardFooterEls)
  if cardFooter ~= nil then
    cardContents:insert(cardFooter)
  end

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
  
  local cardEl = pandoc.Div(cardContents, pandoc.Attr("", clz, attributes))
  return cardEl
end

function addToHeader(card, content, title)
  local cardHeader = utils.findChildDiv(card, isCardHeader)
  if cardHeader then
    if title ~= nil then
      cardHeader.content:insert(1, pandoc.Plain(title))
    end
    cardHeader.content:insert(content)
  else
    local headerContent = pandoc.List({content})
    if title ~= nil then
      headerContent:insert(1, pandoc.Plain(title))
    end
    
    local newHeader = pandoc.Div(headerContent, pandoc.Attr("", {kCardHeaderClass}))
    card.content:insert(1, newHeader)
  end
end

function addToFooter(card, content)
  local cardFooter = utils.findChildDiv(card, isCardFooter)
  if cardFooter then
    cardFooter.content:insert(content)
  else
    local newFooter = pandoc.Div(content, pandoc.Attr("", {kCardFooterClass}))
    card.content:insert(newFooter)
  end
end

function addSidebar(card, content)
  card.content:insert(1, content)
end

function cardBodyContents(card) 
  local bodyEls = pandoc.List({})
  for _i, v in ipairs(card.content) do
    if isCardBody(v) then
      bodyEls:extend(v.content)
    end
  end
  return bodyEls
end

return {
  isCard = isCard,
  isCardBody = isCardBody,
  isCardFooter = isCardFooter,
  cardBodyContents = cardBodyContents,
  isLiteralCard = isLiteralCard,
  readOptions = readOptions,
  makeCard = makeCard,
  addSidebar = addSidebar,
  addToFooter = addToFooter,
  addToHeader = addToHeader,
  hasCardDecoration = hasCardDecoration,
  optionKeys = {
    fill = kFill,
    expandable = kExpandable
  }
}