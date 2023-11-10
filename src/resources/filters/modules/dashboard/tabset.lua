-- tabset.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
local card = require 'modules/dashboard/card'
local cardToolbar = require 'modules/dashboard/card-toolbar'
local utils = require 'modules/dashboard/utils'

-- Tabset classes
local kTabsetClass = "tabset"
local kTabClass = "tab"

local kTabOutputClass = "card"
local kTabBodyClass = "card-body"
local kTabHeaderClass = "card-header"
local kTabFooterClass = "card-footer"

local kTitleAttr = "title"
local kTabAttributes = {kTitleAttr}

local kTabTitleOutAttr = "data-title"

-- pill vs tabs vs underline
-- longer term, could emit a menu that goes with a card or a tabbed card

local function resolveTabHeader(_titleEl, options) 
  if options[kTitleAttr] ~= nil then
    -- Use the explicit title
    return pandoc.Div(options[kTitleAttr], pandoc.Attr("", {kTabHeaderClass}))
  else
    -- Couldn't find a title, but force the header into place
    return pandoc.Div(pandoc.Plain(""), pandoc.Attr("", {kTabHeaderClass}))
  end
end

local function resolveTabFooter(tabFooterEls) 
  if tabFooterEls and #tabFooterEls > 0 then
    return pandoc.Div(tabFooterEls, pandoc.Attr("", {kTabFooterClass}))
  end
end

local function resolveTabs(contents)
  local tabFooterEls = pandoc.List()
  local tabBodyEls = pandoc.List()
  local tabHeaderEls = pandoc.List()

  -- Process the contents (figuring out the tab title, dealing with cards, etc...)
  for _i, v in ipairs(contents) do   

    local tabContent = v
    local attr = {}

    if card.isCard(v) then
      -- If the direct descendent of a tab is a card, just hoist the card contents
      -- up into the tab body and forward along the title and footer
      attr[kTabTitleOutAttr] = v.attributes[kTabTitleOutAttr]

      local cardTabContents = pandoc.List()
      _quarto.ast.walk(v.content, {
        Div = function(divEl)
          if card.isCardBody(divEl) then
            cardTabContents:extend(divEl.content)
          elseif card.isCardFooter(divEl) then
            tabFooterEls:extend(divEl.content)
          end
        end
      })
      tabContent = cardTabContents
    elseif cardToolbar.isCardToolbar(v) then 
      -- If an input panel is captured by a tabset, it will naturally go into the
      -- the header for the tabset - place it and mark it processed
      tabHeaderEls:insert(v)
      cardToolbar.markProcessed(v)
      tabContent = nil
    else
      -- If the direct descrendent of a tab isn't a card, see if it has a header within it
      -- that we can use as the tab title, then just allow the content to flow along
      if v.content and #v.content > 1 then
        if v.content[1].t == "Header" then
          local titleAttr = v.content[1].attributes[kTitleAttr]
          if titleAttr ~= nil then
            attr[kTabTitleOutAttr] = titleAttr
          else
            attr[kTabTitleOutAttr] = pandoc.utils.stringify(v.content[1])
          end   
        end
      end 
    end
    
    if tabContent ~= nil then
      tabBodyEls:insert(pandoc.Div(tabContent, pandoc.Attr("", {kTabBodyClass}, attr)))
    end
  end

  return tabBodyEls, tabHeaderEls, tabFooterEls
end



local function makeTabset(title, contents, classes, options)  

  -- compute the card contents
  local tabContents = pandoc.List({})

  -- the card header
  local tabHeader = resolveTabHeader(title, options)
  
  if tabHeader ~= nil then
    tabContents:insert(tabHeader)  
  end

  -- compute the card body(ies)
  local tabEls, tabHeaderEls, tabFooterEls = resolveTabs(contents)
  tabContents:extend(tabEls)

  -- add anything to header that needs to be added
  if tabHeaderEls ~= nil and tabHeader ~= nil then
    tprepend(tabHeader.content, tabHeaderEls)
  end

  -- compute any card footers
  local tabFooter = resolveTabFooter(tabFooterEls)
  if tabFooter ~= nil then
    tabContents:insert(tabFooter)
  end

  -- add outer classes
  local clz = pandoc.List({kTabOutputClass, kTabsetClass})
  if classes then
    clz:extend(classes)
  end

  -- forward options onto attributes
  local attributes = {}
  options = options or {}  
  for k,v in pairs(options) do
    attributes['data-' .. k] = pandoc.utils.stringify(v)
  end
  
  local tabEl = pandoc.Div(tabContents, pandoc.Attr("", clz, attributes))
  return tabEl

end

local function isTabset(el)
  return (el.t == "Div" or el.t == "Header") and el.classes ~= nil and el.classes:includes(kTabsetClass)
end

local function readOptions(el)

  local options = {}
  
  if el.attributes ~= nil then
    for _i, v in ipairs(kTabAttributes) do
      if el.attributes[v] ~= nil then
        options[v] = el.attributes[v]
      end
    end
  end

  local clz = pandoc.List()
  if el.classes ~= nil then
    clz = el.classes:filter(function(class)
      -- strip the tabset class
      return class ~= kTabsetClass
    end)  
  end
  
  return options, clz

end

local function isTabHeader(el)
  return el.t == "Div" and el.classes ~= nil and el.classes:includes(kTabHeaderClass)
end

local function isTabFooter(el)
  return el.t == "Div" and el.classes ~= nil and el.classes:includes(kTabFooterClass)
end

function addToHeader(tabset, content, title)
  local tabsetHeader = utils.findChildDiv(tabset, isTabHeader)
  if tabsetHeader then
    if title ~= nil then
      tabsetHeader.content:insert(1, pandoc.Plain(title))
    end
    tabsetHeader.content:insert(content)
  else
    local headerContent = pandoc.List(content)
    if title ~= nil then
      headerContent:insert(1, pandoc.Plain(title))
    end
    local newHeader = pandoc.Div(headerContent, pandoc.Attr("", {kTabHeaderClass}))
    tabset.content:insert(1, newHeader)
  end
end

function addToFooter(tabset, content)
  local tabsetFooter = utils.findChildDiv(tabset, isTabFooter)
  if tabsetFooter then
    tabsetFooter.content:insert(content)
  else
    local newFooter = pandoc.Div(content, pandoc.Attr("", {kTabFooterClass}))
    card.content:insert(newFooter)
  end
end

return {
  isTabset = isTabset,
  readOptions = readOptions,
  makeTabset = makeTabset,
  addToHeader = addToHeader,
  addToFooter = addToFooter
}

