-- sidebar.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
local card = require "modules/dashboard/card"
local layout = require "modules/dashboard/layout"


-- left or right position (or both)
-- theming / colors


-- Sidebar classes
local kSidebarPanelClass = "sidebar-panel"
local kSidebarClass = "sidebar"
local kSidebarContentClass = "sidebar-content"

local kSidebarWidthOutAttr = "data-width"
local kSidebarWidthAttr = "width"
local kSidebarWidthAttrs = pandoc.List({kSidebarWidthAttr, kSidebarWidthOutAttr})

local function isSidebar(el) 
  return el.classes ~= nil and el.classes:includes(kSidebarClass)
end 

local function readOptions(el)  
  local options = {}
  for _i, v in ipairs(kSidebarWidthAttrs) do
    if el.attributes[v] ~= nil then
      options[kSidebarWidthAttr] = el.attributes[v]
    end
  end
  return options
end

local function sidebarAttr(options)
  local sidebarAttrs = {}
  if options[kSidebarWidthAttr] ~= nil then 
    sidebarAttrs[kSidebarWidthOutAttr] = options[kSidebarWidthAttr]
  end
  return sidebarAttrs
end

local function makeSidebar(sidebarEls, contentEls, options) 

  local sidebarContainerEl = pandoc.Div({}, pandoc.Attr("", {kSidebarPanelClass}))

  local sidebarContentsFiltered = pandoc.List({})
  for i,v in ipairs(sidebarEls) do
    if card.isCard(v) then
      -- TODO: really do a better job of de-composing the card
      sidebarContentsFiltered:insert(v.content[1])
    else
      sidebarContentsFiltered:insert(v)
    end
  end

  -- TODO: forward title
  local sidebarEl = pandoc.Div(sidebarContentsFiltered, pandoc.Attr("", {kSidebarClass}, sidebarAttr(options)))

  local sidebarColumns = layout.orientContents(contentEls, layout.orientations.columns, {})
  local sidebarContentsEl = pandoc.Div(sidebarColumns, pandoc.Attr("", {kSidebarContentClass}))
  sidebarContainerEl.content:extend({sidebarEl, sidebarContentsEl})

  return sidebarContainerEl
end

local function pageSidebarPlaceholder(contents, options) 
  local sidebarContainer = pandoc.Div(contents, pandoc.Attr("", {kSidebarClass}, sidebarAttr(options)))
  return sidebarContainer
end

function maybeUseSidebarOrientation(el)
  -- force the global orientation to columns if there is a sidebar present
  local hasSidebar = false
  _quarto.ast.walk(el, {
    Header = function(header)
      if header.level == 1 and isSidebar(header) then
        hasSidebar = true
      end
    end,
    Div = function(div)
      if isSidebar(div) then
        hasSidebar = true
      end
    end
  })
  if hasSidebar then
    return layout.orientations.columns
  else
    return nil
  end
end


return {
  isSidebar = isSidebar,
  readOptions = readOptions,
  makeSidebar = makeSidebar,
  pageSidebarPlaceholder = pageSidebarPlaceholder,
  maybeUseSidebarOrientation = maybeUseSidebarOrientation
}


