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

local kSidebarPositionAttr = "position"
local kSidebarPositionStart = "left"
local kSidebarPositionEnd = "right"

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

  if el.attributes[kSidebarPositionAttr] ~= nil then
    options[kSidebarPositionAttr] = el.attributes[kSidebarPositionAttr];
  end
  return options
end

local function sidebarAttr(options)
  local sidebarAttrs = {}
  if options[kSidebarWidthAttr] ~= nil then 
    sidebarAttrs[kSidebarWidthOutAttr] = options[kSidebarWidthAttr]
  end

  if options[kSidebarPositionAttr] ~= nil then
    sidebarAttrs[kSidebarPositionAttr] = options[kSidebarPositionAttr]
  end
  return sidebarAttrs
end

local function makeSidebar(sidebarEls, contentEls, options) 

  local sidebarContainerEl = pandoc.Div({}, pandoc.Attr("", {kSidebarPanelClass}))

  local sidebarContentsFiltered = pandoc.List({})
  for i,v in ipairs(sidebarEls) do
    if card.isCard(v) then
      local cardContents = card.cardBodyContents(v)
      sidebarContentsFiltered:extend(cardContents)
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

function sidebarInContents(content)
  local hasSidebar = false
  for i, v in ipairs(content) do
    if v.t == "Header" then
      if v.level == 1 and isSidebar(v) then
        hasSidebar = true
        break
      end
    elseif is_regular_node(v, "Div")  then
      
      if isSidebar(v) then
        hasSidebar = true
        break
      end
    end
  end
  return hasSidebar
end

function hasChildSidebar(el)

  -- force the global orientation to columns if there is a sidebar present
  local hasSidebar = false
  local elType = pandoc.utils.type(el)
  if elType == "Pandoc" then
    hasSidebar = sidebarInContents(el.blocks)
  else
    hasSidebar = sidebarInContents(el.content)
  end

  return hasSidebar
end

function setPositionEnd(options)
  options[kSidebarPositionAttr] = kSidebarPositionEnd
end


return {
  isSidebar = isSidebar,
  readOptions = readOptions,
  makeSidebar = makeSidebar,
  pageSidebarPlaceholder = pageSidebarPlaceholder,
  hasChildSidebar = hasChildSidebar,
  setPositionEnd = setPositionEnd
}


