-- html.lua
-- Copyright (C) 2021 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- initialize tabset index
local tabsetidx = 1

-- make images responsive (unless they have an explicit height attribute)
Image = function(image)
  if not image.attr.attributes["height"] then
    image.attr.classes:insert("img-fluid")
    return image
  end
end

-- tabsets and notices
Div = function(div)
  if div.attr.classes:find_if(isNotice) then
    return noticeDiv(div)
  elseif div.attr.classes:find("tabset") then
    return tabsetDiv(div)
  end  
end

function noticeDiv(div)

  -- Make an outer card div and transfer classes
  local noticeDiv = pandoc.Div({})
  noticeDiv.attr.classes = div.attr.classes:clone()
  div.attr.classes = pandoc.List:new() 

  -- add card attribute
  noticeDiv.attr.classes:insert("card")

  -- the image placeholder
  local imgPlaceholder = pandoc.Plain({pandoc.RawInline("html", "<i class='notice-img'></i>")});
        
  -- capture caption information
  local caption = div.attr.attributes["caption"]
  div.attr.attributes["caption"] = nil

  if caption ~= nil then
    -- create a card with title
    -- create the header to contain the caption
    local headerDiv = pandoc.Div({imgPlaceholder, pandoc.Plain(caption)}, pandoc.Attr("", {"card-header"}))
    noticeDiv.content:insert(headerDiv)
      
    -- make the existing div the card body and add it to the notice
    div.attr.classes:insert("card-body")
    noticeDiv.content:insert(div)

  else 
    -- create a card without a title
    -- div that holds image placeholder
    local imgDiv = pandoc.Div({imgPlaceholder});
    
    -- create a card body
    local containerDiv = pandoc.Div({imgDiv, div}, pandoc.Attr("", {"card-body"}))

    -- add the container to the notice card
    noticeDiv.content:insert(containerDiv)
  end
  
  return noticeDiv
end

function isNotice(class)
  return class:match("^notice-")
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