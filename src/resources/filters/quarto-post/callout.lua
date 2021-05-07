-- callout.lua
-- Copyright (C) 2021 by RStudio, PBC

local calloutidx = 1

function callout() 
  return {
  
    -- Convert callout Divs into the appropriate element for this format
    Div = function(div)
      if div.attr.classes:find_if(isCallout) then
        postState.hasCallouts = true
        if isHtmlOutput() then
          return calloutDiv(div) 
        elseif isLatexOutput() then
          return calloutLatex(div)
        else
          return simpleCallout(div)
        end
      end  
    end
  }
end

function isCallout(class)
  return class:match("^callout%-")
end

function calloutType(div)
  for _, class in ipairs(div.attr.classes) do
    if isCallout(class) then 
      return class:match("^callout%-(.*)")
    end
  end
  return nil
end

-- an HTML callout div
function calloutDiv(div)

-- the first heading is the caption
local capEl = div.content[1]
local caption
if capEl ~= nil and capEl.t == 'Header' then
caption = capEl
div.content:remove(1)
end


local icon = div.attr.attributes["icon"]
div.attr.attributes["icon"] = nil

local collapse = div.attr.attributes["collapse"]
div.attr.attributes["collapse"] = nil

-- Make an outer card div and transfer classes
local calloutDiv = pandoc.Div({})
calloutDiv.attr.classes = div.attr.classes:clone()
div.attr.classes = pandoc.List:new() 

-- add card attribute
calloutDiv.attr.classes:insert("callout")

-- the image placeholder
local noicon = ""
if icon == "false" then
  noicon = "no-icon"
end
local imgPlaceholder = pandoc.Plain({pandoc.RawInline("html", "<i class='callout-icon" .. noicon .. "'></i>")});       
local imgDiv = pandoc.Div({imgPlaceholder}, pandoc.Attr("", {"callout-icon-container"}));

-- show a captioned callout
if caption ~= nil then

  -- mark the callout as being captioned
  calloutDiv.attr.classes:insert("callout-captioned")

  -- create a unique id for the callout
  local calloutid = "callout-" .. calloutidx
  calloutidx = calloutidx + 1

  -- create the header to contain the caption
  -- caption should expand to fill its space
  local captionDiv = pandoc.Div(pandoc.Plain(caption.content), pandoc.Attr("", {"flex-fill"}))
  local headerDiv = pandoc.Div({imgDiv, captionDiv}, pandoc.Attr("", {"callout-header", "d-flex", "align-content-center"}))
  local bodyDiv = div
  bodyDiv.attr.classes:insert("callout-body")

  if collapse ~= nil then 

    -- collapse default value     
    local expandedAttrVal= "true"
    if collapse == "true" then
      expandedAttrVal = "false"
    end

    -- create the collapse button
    local btnClasses = "callout-btn-toggle btn d-inline-block border-0 py-1 ps-1 pe-0 float-end"
    local btnIcon = "<i class='callout-toggle'></i>"
    local toggleButton = pandoc.RawInline("html", "<button type='button' class='" .. btnClasses .. "'>" .. btnIcon .. "</button>")
    headerDiv.content:insert(pandoc.Plain(toggleButton));

    -- configure the header div for collapse
    headerDiv.attr.attributes["bs-toggle"] = "collapse"
    headerDiv.attr.attributes["bs-target"] = "#" .. calloutid
    headerDiv.attr.attributes["aria-controls"] = calloutid
    headerDiv.attr.attributes["aria-expanded"] = expandedAttrVal
    headerDiv.attr.attributes["aria-label"] = 'Toggle callout'

    -- configure the body div for collapse
    local collapseDiv = pandoc.Div({})
    collapseDiv.attr.identifier = calloutid
    collapseDiv.attr.classes:insert("callout-collapse")
    collapseDiv.attr.classes:insert("collapse")
    if expandedAttrVal == "true" then
      collapseDiv.attr.classes:insert("show")
    end

    -- add the current body to the collapse div and use the collapse div instead
    collapseDiv.content:insert(bodyDiv)
    bodyDiv = collapseDiv
  end

  -- add the header and body to the div
  calloutDiv.content:insert(headerDiv)
  calloutDiv.content:insert(bodyDiv)

  else 
    -- show an uncaptioned callout
  
    -- create a card body
    local containerDiv = pandoc.Div({imgDiv, div}, pandoc.Attr("", {"callout-body"}))
    containerDiv.attr.classes:insert("d-flex")

    -- add the container to the callout card
    calloutDiv.content:insert(containerDiv)
  end
  
  return calloutDiv
end

-- Latex awesomebox callout
function calloutLatex(div)
  
  -- read and clear attributes
  local caption = div.attr.attributes["caption"]
  local type = calloutType(div)

  div.attr.attributes["caption"] = nil
  div.attr.attributes["icon"] = nil
  div.attr.attributes["collapse"] = nil

  local calloutContents = pandoc.List:new({});
    
  -- Add the captions and contents
  if caption == nil then 
    caption = type:sub(1,1):upper()..type:sub(2)
  end
  calloutContents:insert(pandoc.Para(stringToInlines(caption)))
  tappend(calloutContents, div.content)

  -- Add the environment info, using inlines if possible 
  local environment = environmentForType(type);  
  local beginEnvironment = pandoc.RawInline('latex', '\\begin{' .. environment .. '}\n')
  local endEnvironment = pandoc.RawInline('latex', '\n\\end{' .. environment .. '}')
  if calloutContents[1].t == "Para" and calloutContents[#calloutContents].t == "Para" then
    table.insert(calloutContents[1].content, 1, beginEnvironment)
    table.insert(calloutContents[#calloutContents].content, endEnvironment)
  else
    table.insert(calloutContents, 1, pandoc.Para({beginEnvironment}))
    table.insert(calloutContents, pandoc.Para({endEnvironment}))
  end
  return pandoc.Div(calloutContents)
end

function simpleCallout(div) 
  local caption = div.attr.attributes["caption"]
  local type = calloutType(div)

  div.attr.attributes["caption"] = nil
  div.attr.attributes["icon"] = nil
  div.attr.attributes["collapse"] = nil

  local calloutContents = pandoc.List:new({});
    
  -- Add the captions and contents
  if caption == nil then 
    caption = type:sub(1,1):upper()..type:sub(2)
  end
  calloutContents:insert(pandoc.Para(pandoc.Strong(stringToInlines(caption))))
  tappend(calloutContents, div.content)

  return pandoc.BlockQuote(calloutContents)
end

function environmentForType(type, caption)
  if type == 'note' then
    return "noteblock"
  elseif type == "warning" then
    return "warningblock"
  elseif type == "important" then
    return "importantblock"
  elseif type == "caution" then
    return "cautionblock"
  elseif type == "tip" then 
    return "tipblock"
  else
    return "noteblock"
  end
end

