-- sidebar.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


-- Valuebox classes
local kSidebarPanelClass = "sidebar-panel"
local kSidebarClass = "sidebar"
local kSidebarContentsClass = "contents"

local function isSidebar(el) 
  return el.classes:includes(kSidebarPanelClass)
end 

local function makeSidebar(title, sidebar, content) 

  local sidebarContainerEl = pandoc.Div({}, pandoc.Attr("", {kSidebarPanelClass}))

  -- TODO: forward title
  local sidebarEl = pandoc.Div(sidebar, pandoc.Attr("", {kSidebarClass}, {}))
  local sidebarContentsEl = pandoc.Div(content, pandoc.Attr("", {kSidebarContentsClass}))
  sidebarContainerEl.content:extend({sidebarEl, sidebarContentsEl})

  return sidebarContainerEl
end

return {
  isSidebar = isSidebar,
  makeSidebar = makeSidebar,
}


