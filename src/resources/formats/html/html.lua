-- html.lua
-- Copyright (C) 2021 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- initialize tabset index
local tabsetidx = 1
local calloutidx = 1


-- make images responsive (unless they have an explicit height attribute)
Image = function(image)
  if not image.attr.attributes["height"] then
    image.attr.classes:insert("img-fluid")
    return image
  end
end

-- tabsets and callouts
Div = function(div)
  if div.attr.classes:find_if(isCallout) then
    return calloutDiv(div)
  elseif div.attr.classes:find("tabset") then
    return tabsetDiv(div)
  end  
end

function calloutDiv(div)


  -- read and clear attributes
  local caption = div.attr.attributes["caption"]
  div.attr.attributes["caption"] = nil

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
        
  -- show a captioned callout
  if caption ~= nil then

    -- mark the callout as being captioned
    calloutDiv.attr.classes:insert("callout-captioned")

    -- create a unique id for the callout
    local calloutid = "callout-" .. calloutidx
    calloutidx = calloutidx + 1

    -- create the header to contain the caption
    local headerDiv = pandoc.Div({imgPlaceholder, pandoc.Plain(caption)}, pandoc.Attr("", {"callout-header"}))
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
    -- div that holds image placeholder
    local imgDiv = pandoc.Div({imgPlaceholder}, pandoc.Attr("", {"callout-icon-container"}));
    
    -- create a card body
    local containerDiv = pandoc.Div({imgDiv, div}, pandoc.Attr("", {"callout-body"}))
    containerDiv.attr.classes:insert("d-flex")

    -- add the container to the callout card
    calloutDiv.content:insert(containerDiv)
  end
  
  return calloutDiv
end

function isCallout(class)
  return class:match("^callout-")
end

function tabsetDiv(div)

  -- create a unique id for the tabset
  local tabsetid = "tabset-" .. tabsetidx
  tabsetidx = tabsetidx + 1

  -- find the first heading in the tabset
  local heading = div.content:find_if(function(el) return el.t == "Header" end)
  if heading ~= nil then
    -- note the level, then build tab buckets for content after these levels
    local level = heading.level
    local tabs = pandoc.List:new()
    local tab = nil
    for i=1,#div.content do 
      local el = div.content[i]
      if el.t == "Header" and el.level == level then
        tab = pandoc.Div({})
        tab.content:insert(el)
        tabs:insert(tab)
      elseif tab ~= nil then
        tab.content:insert(el)
      end
    end

    -- init tab navigation 
    local nav = pandoc.List:new()
    nav:insert(pandoc.RawInline('html', '<ul class="nav nav-tabs mb-3" role="tablist">'))

    -- init tab panes
    local panes = pandoc.Div({}, div.attr)
    panes.attr.classes = div.attr.classes:map(function(class) 
      if class == "tabset" then
        return "tab-content" 
      else
        return name
      end
    end)
   
    -- populate
    for i=1,#tabs do
      -- alias tab and heading
      local tab = tabs[i]
      local heading = tab.content[1]
      tab.content:remove(1)

      -- tab id
      local tabid = tabsetid .. "-" .. i
      local tablinkid = tabid .. "-tab"

      -- navigation
      local active = ""
      local selected = "false"
      if i==1 then
        active = " active"
        selected = "true"
      end
      nav:insert(pandoc.RawInline('html', '<li class="nav-item" role="presentation">'))
      nav:insert(pandoc.RawInline('html', '<a class="nav-link' .. active .. '" id="' .. tablinkid .. '" data-bs-toggle="tab" data-bs-target="#' .. tabid .. '" role="tab" aria-controls="' .. tabid .. '" aria-selected="' .. selected .. '">'))
      nav:extend(heading.content)
      nav:insert(pandoc.RawInline('html', '</a></li>'))

      -- pane
      local pane = pandoc.Div({}, heading.attr)
      pane.attr.identifier = tabid
      pane.attr.classes:insert("tab-pane")
      if i==1 then
        pane.attr.classes:insert("active")
      end
      pane.attr.attributes["role"] = "tabpanel"
      pane.attr.attributes["aria-labeledby"] = tablinkid
      pane.content:extend(tab.content)
      panes.content:insert(pane)
    end

    -- end tab navigation
    nav:insert(pandoc.RawInline('html', '</ul>'))

    -- return tabset
    return pandoc.List({
      pandoc.Plain(nav),
      panes
    })

  end 
end