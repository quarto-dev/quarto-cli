-- panel-tabset.lua
-- Copyright (C) 2021 by RStudio, PBC

local tabsetidx = 1

function panelTabset() 
  return {
    -- tabsets and callouts
    Div = function(div)
      if div.attr.classes:find("panel-tabset") then
        if hasBootstrap() then
          return tabsetDiv(div, bootstrapTabs())
        elseif isHtmlOutput() then
          return tabsetDiv(div, tabbyTabs())
        elseif isLatexOutput() or isDocxOutput() or isEpubOutput() then
          return tabsetLatex(div)
        end
      else
        return div
      end  
    end
  }
end


function tabsetDiv(div, renderer)

  -- create a unique id for the tabset
  local tabsetid = "tabset-" .. tabsetidx
  tabsetidx = tabsetidx + 1

  -- find the first heading in the tabset
  local heading = div.content:find_if(function(el) return el.t == "Header" end)
  if heading ~= nil then
    -- note the level, then build tab buckets for content after these levels
    local level = heading.level
    local tabs = pandoc.List()
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
    local nav = pandoc.List()
    nav:insert(pandoc.RawInline('html', '<ul ' .. renderer.ulAttribs(tabsetid) .. '>'))

    -- init tab panes
    local panes = pandoc.Div({}, div.attr)
    panes.attr.classes = div.attr.classes:map(function(class) 
      if class == "panel-tabset" then
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
      nav:insert(pandoc.RawInline('html', '<li ' .. renderer.liAttribs() .. '>'))
      nav:insert(pandoc.RawInline('html', '<a ' .. renderer.liLinkAttribs(tabid, i==1) .. '>'))
      nav:extend(heading.content)
      nav:insert(pandoc.RawInline('html', '</a></li>'))

      -- pane
      local paneAttr = renderer.paneAttribs(tabid, i==1, heading.attr)
      local pane = pandoc.Div({}, paneAttr)
      pane.content:extend(tab.content)
      panes.content:insert(pane)
    end

    -- end tab navigation
    nav:insert(pandoc.RawInline('html', '</ul>'))

    -- return tabset
    return pandoc.Div({
      pandoc.Plain(nav),
      panes
    }, div.attr:clone())

  end 
end

function bootstrapTabs() 
  return {
    ulAttribs = function(tabsetid)
      return 'class="nav nav-tabs" role="tablist"'
    end,
    liAttribs = function(tabid, isActive)
      return 'class="nav-item" role="presentation"'
    end,
    liLinkAttribs = function(tabid, isActive)
      local tablinkid = tabid .. "-tab"
      local active = ""
      local selected = "false"
      if isActive then
        active = " active"
        selected = "true"
      end
      return 'class="nav-link' .. active .. '" id="' .. tablinkid .. '" data-bs-toggle="tab" data-bs-target="#' .. tabid .. '" role="tab" aria-controls="' .. tabid .. '" aria-selected="' .. selected .. '"'
    end,
    paneAttribs = function(tabid, isActive, headingAttribs)
      local tablinkid = tabid .. "-tab"
      local attribs = headingAttribs:clone()
      attribs.identifier = tabid
      attribs.classes:insert("tab-pane")
      if isActive then
        attribs.classes:insert("active")
      end
      attribs.attributes["role"] = "tabpanel"
      attribs.attributes["aria-labeledby"] = tablinkid
      return attribs
    end
  }
end

function tabbyTabs()
  return {
    ulAttribs = function(tabsetid)
      return 'id="' .. tabsetid .. '" class="panel-tabset-tabby"'
    end,
    liAttribs = function(tabid, isActive)
      return ''
    end,
    liLinkAttribs = function(tabid, isActive)
      local default = ""
      if isActive then
        default = "data-tabby-default "
      end
      return default .. 'href="#' .. tabid .. '"'
    end,
    paneAttribs = function(tabid, isActive, headingAttribs)
      local attribs = headingAttribs:clone()
      attribs.identifier = tabid
      return attribs
    end
  }
end


function tabsetLatex(div)
  -- find the first heading in the tabset
  local heading = div.content:find_if(function(el) return el.t == "Header" end)
  if heading ~= nil then
    local level = heading.level
    if level < 4 then
      heading.level = 4

      for i=1,#div.content do 
        local el = div.content[i]
        if el.t == "Header" and el.level == level then
          el.level = 4
        end
      end 
    end
  end

  return div
end