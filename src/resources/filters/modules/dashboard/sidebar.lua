-- sidebar.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
local card = require "modules/dashboard/card"


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

  local sidebarContentsEl = pandoc.Div(contentEls, pandoc.Attr("", {kSidebarContentClass}))
  sidebarContainerEl.content:extend({sidebarEl, sidebarContentsEl})

  return sidebarContainerEl
end

local function pageSidebarPlaceholder(contents, options) 
  local sidebarContainer = pandoc.Div(contents, pandoc.Attr("", {kSidebarClass}, sidebarAttr(options)))
  return sidebarContainer
end

return {
  isSidebar = isSidebar,
  readOptions = readOptions,
  makeSidebar = makeSidebar,
  pageSidebarPlaceholder = pageSidebarPlaceholder
}


