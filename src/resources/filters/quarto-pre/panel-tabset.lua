-- panel-tabset.lua
-- Copyright (C) 2021 by RStudio, PBC

local tabsetidx = 1

function panelTabset() 
  return {
    -- tabsets and callouts
    Div = function(div)
      if hasBootstrap() and div.attr.classes:find("panel-tabset") then
        return tabsetDiv(div)
      elseif isLatexOutput() or isDocxOutput() or isEpubOutput() then
        return tabsetLatex(div)
      else
        return div
      end  
    end
  }
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
    nav:insert(pandoc.RawInline('html', '<ul class="nav nav-tabs" role="tablist">'))

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
    return pandoc.Div({
      pandoc.Plain(nav),
      panes
    }, div.attr:clone())

  end 
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