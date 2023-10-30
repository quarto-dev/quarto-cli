-- tabset.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

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


-- title
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

  for _i, v in ipairs(contents) do
    
    local attr = {}
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
    
    tabBodyEls:insert(pandoc.Div(v, pandoc.Attr("", {kTabBodyClass}, attr)))
  end

  return tabBodyEls, tabFooterEls
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
  local tabEls, tabFooterEls = resolveTabs(contents)
  tabContents:extend(tabEls)

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
  return (el.t == "Div" or el.t == "Header") and el.classes:includes(kTabsetClass)
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


return {
  isTabset = isTabset,
  readOptions = readOptions,
  makeTabset = makeTabset

}

