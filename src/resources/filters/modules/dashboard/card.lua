-- card.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- Card classes
local kCardClass = "card"
local kCardHeaderClass = "card-header"
local kCardBodyClass = "card-body"
local kCardFooterClass = "card-footer"

-- Tabset classes
local kTabsetClass = "tabset"
local kTabClass = "tab"

-- Cell classes
local kCellClass = "cell"
local kFlowClass = "flow"
local kFillClass = "fill"

-- Implicit Card classes, these mean that this is a card
-- even if it isn't specified
local kCardClz = pandoc.List({kCardClass, kTabsetClass})
local kCardBodyClz = pandoc.List({kCardBodyClass, kTabClass, kCellClass})
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
local kLayout = "layout"



-- Card explicit attributes
local kCardAttributes = pandoc.List({kTitle, kPadding, kHeight, kWidth, kMinHeight, kMaxHeight, kExpandable})

-- Card Body Explicit Attributes
local kCardBodyAttributes = pandoc.List({kTitle, kHeight, kMinHeight, kMaxHeight})

-- Card Options
local kForceHeader = "force-header";

-- pop images out of paragraphs to the top level
-- this is necessary to ensure things like `object-fit`
-- will work with images (because they're directly contained)
-- in a constraining element
local function popImagePara(el)
  if el.t == "Para" and #el.content == 1 then
    return pandoc.Plain(el.content)
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
  return (el.t == "Div" or el.t == "Header") and el.classes ~= nil and el.classes:find_if(function(class) 
    return kCardClz:includes(class)
  end) 
end

local function isCardBody(el) 
  return el.t == "Div" and el.classes ~= nil and el.classes:find_if(function(class) 
    return kCardBodyClz:includes(class)
  end) 
end
local function isCardFooter(el)
  return el.t == "BlockQuote" or (el.t == "Div" and el.classes:includes(kCardFooterClass))
end

local function isCardHeader(el)
  return el.t == "Div" and el.classes ~= nil and el.classes:find_if(function(class) 
    return kCardHeaderClz:includes(class)
  end) 
end

local function isTabset(el)
  return (el.t == "Div" or el.t == "Header") and el.classes:includes(kTabsetClass)
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
  return hasReal
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
  
  if el.classes ~= nil then
    for _i, v in ipairs(kCardClzToAttr) do
      if el.classes:includes(v) then
        options[v] = true
      end
    end

    if el.classes:includes(kFlowClass) then
      options[kLayout] = kFlowClass
    elseif el.classes:includes(kFillClass) then
      options[kLayout] = kFillClass
    end
  end

  if el.attributes ~= nil then
    for _i, v in ipairs(kCardAttributes) do
      if el.attributes[v] ~= nil then
        options[v] = el.attributes[v]
      end
    end
  end

  -- note whether this card should force the header on
  options[kForceHeader] = isTabset(el)

  local clz = pandoc.List()
  if el.classes ~= nil then
    clz = el.classes:filter(function(class)
      return not kCardClzToAttr:includes(class)
    end)  
  end
  
  return options, clz
end

local function resolveCardHeader(title, options) 
  if title ~= nil then
    if pandoc.utils.type(title) == "table" and #title > 0 then
      --- The title is a table with value
      return pandoc.Div(title, pandoc.Attr("", {kCardHeaderClass}))
    elseif options[kTitle] ~= nil then
      return pandoc.Div(string_to_quarto_ast_inlines(options[kTitle]), pandoc.Attr("", {kCardHeaderClass}))
    elseif options[kForceHeader] then
      -- Couldn't find a title, but force the header into place
      return pandoc.Div(pandoc.Plain(""), pandoc.Attr("", {kCardHeaderClass}))  
    end
  elseif options and options[kTitle] ~= nil then
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
  local function collectBodyContentEl(el)
    local popped = popImagePara(el)
    collectedBodyEls:insert(popped)
  end

  -- ensure that contents is a list
  if pandoc.utils.type(contents) == "table" and contents[1] == nil then
    contents = {contents}
  end

  for _i,v in ipairs(contents) do
    
     
     if v.classes ~= nil and v.classes:includes("section") then
      flushCollectedBodyContentEls()
      local sectionContent = v.content
      
      if next(sectionContent) ~= nil then
        local headerEl = sectionContent[1]
        local cardEls = tslice(sectionContent, 2)

        -- the header
        local cardBodiesToMerge = pandoc.List({})
        local cardFootersToMerge = pandoc.List({})
        for i, cardEl in ipairs(cardEls) do

          local cardBodyEls, cardFooterEls = resolveCardBodies(cardEl.content)
          if cardBodyEls ~= nil then 
            cardBodiesToMerge:extend(cardBodyEls)
          end
    
          if cardFooterEls ~= nil then
            cardFootersToMerge:extend(cardFooterEls)
          end
        end

        local contentDiv = pandoc.Div({}, pandoc.Attr("", {kCardBodyClass}))
        for i, cardBodyEl in ipairs(cardBodiesToMerge) do
          contentDiv.content:extend(cardBodyEl.content)
        end

        if headerEl ~= nil then
          contentDiv.attributes['data-title'] = pandoc.utils.stringify(headerEl)
        end

        bodyContentEls:insert(contentDiv)
      
      end

     elseif isCard(v) then
      flushCollectedBodyContentEls()

      -- this is a card that is nested inside a card. Turn it into a card
      local cardContentEls = v.content
      local title = nil
      if v.content[1] ~= nil and isCardHeader(v.content[1]) then
        cardContentEls = tslice(v.content, 2)
        title = pandoc.utils.stringify(v.content[1].content) or ""
      end
      

      local cardBodyEls, cardFooterEls = resolveCardBodies(cardContentEls)
      if title ~= nil and next(cardBodyEls) ~= nil then
        cardBodyEls[1].attributes['data-title'] = title
      end
      
      if cardBodyEls ~= nil then 
        bodyContentEls:extend(cardBodyEls)
      end

      if cardFooterEls ~= nil then
        footerContentEls:extend(cardFooterEls)
      end

    elseif isCardBody(v) then
      flushCollectedBodyContentEls()

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
      bodyContentEls:insert(popped)

    elseif isCardFooter(v) then
      footerContentEls:extend(v.content)
    else
      collectBodyContentEl(v)
    end    
  end
  flushCollectedBodyContentEls()
  
  return bodyContentEls, footerContentEls
end

-- title: string
-- contents: table
-- classes: table
-- Card DOM structure
-- .card[scrollable, max-height, min-height, full-screen(true, false), full-bleed?,]
--   .card-header
--   .card-body[max-height, min-height]
local function makeCard(title, contents, classes, options)  


  -- Inspect the loose content and don't make cards out of things that don't look cardish
  local hasRealContent = hasRealLookingContent(contents)
  if not hasRealContent then
    return nil
  end

  -- compute the card contents
  local cardContents = pandoc.List({})

  -- the card header
  local cardHeader = resolveCardHeader(title, options)
  
  if cardHeader ~= nil then
    cardContents:insert(cardHeader)  
  end

  -- compute the card body(ies)
  local cardBodyEls, cardFooterEls = resolveCardBodies(contents)

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
  
  return pandoc.Div(cardContents, pandoc.Attr("", clz, attributes))
end

return {
  isCard = isCard,
  isLiteralCard = isLiteralCard,
  makeCard = makeCard,
  readCardOptions = readCardOptions,
  optionKeys = {
    layout = kLayout
  },
  optionValues = {
    flow = kFlowClass
  }
}