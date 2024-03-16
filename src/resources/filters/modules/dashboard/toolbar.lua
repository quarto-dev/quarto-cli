-- toolbar.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
local card = require "modules/dashboard/card"
local layout = require "modules/dashboard/layout"


-- top or bottom position


-- Sidebar classes
local kToolbarPanelClass = "toolbar-panel"
local kToolbarClass = "toolbar"
local kToolbarContentClass = "toolbar-content"

local kToolbarHeightOutAttr = "data-height"
local kToolbarHeightAttr = "height"
local kToolbarHeightAttrs = pandoc.List({kSidebarHeightAttr, kSidebarHeightOutAttr})

local kToolbarPositionAttr = "position"
local kToolbarPositionStart= "start"
local kToolbarPositionEnd = "end"

local function isToolbar(el) 
  return el.classes ~= nil and el.classes:includes(kToolbarClass)
end 

local function readOptions(el)  
  local options = {}
  if el ~= nil then
    for _i, v in ipairs(kToolbarHeightAttrs) do
      if el.attributes[v] ~= nil then
        options[kToolbarHeightAttr] = el.attributes[v]
      end
    end

    if el.attributes[kToolbarPositionAttr] ~= nil then
      options[kToolbarPositionAttr] = el.attributes[kToolbarPositionAttr]
    end
  end
  return options
end

local function toolbarAttr(options)
  local toolbarAttrs = {}
  if options[kToolbarHeightAttr] ~= nil then 
    toolbarAttrs[kToolbarHeightAttr] = options[kToolbarHeightAttr]
  end
  
  if options[kToolbarPositionAttr] ~= nil then
    toolbarAttrs[kToolbarPositionAttr] = options[kToolbarPositionAttr]
  end

  toolbarAttrs['layout'] = "flow"
  return toolbarAttrs
end

local function makeToolbar(toolbarEls, contentEls, options) 

  local toolbarContainerEl = pandoc.Div({}, pandoc.Attr("", {kToolbarPanelClass}))

   local toolbarContentsFiltered = pandoc.List({})
  for i,v in ipairs(toolbarEls) do
    if card.isCard(v) then
      local cardContents = card.cardBodyContents(v)
      toolbarContentsFiltered:extend(cardContents)
    else
      toolbarContentsFiltered:insert(v)
    end
  end

  local toolbarEl = pandoc.Div(toolbarContentsFiltered, pandoc.Attr("", {kToolbarClass}, toolbarAttr(options)))

  local toolbarRows = layout.orientContents(contentEls, layout.orientations.rows, {})
  local toolbarContentsEls = pandoc.Div(toolbarRows, pandoc.Attr("", {kToolbarContentClass}))
  toolbarContainerEl.content:extend({toolbarEl, toolbarContentsEls})

  return toolbarContainerEl
end

local function pageToolbarPlaceholder(contents, options) 
  local toolbarContainer = pandoc.Div(contents, pandoc.Attr("", {kToolbarClass}, toolbarAttr(options)))
  return toolbarContainer
end

function toolbarInContents(content)
  local hasToolbar = false
  for i, v in ipairs(content) do
    if v.t == "Header" then
      if v.level == 1 and isToolbar(v) then
        hasToolbar = true
        break
      end
    elseif is_regular_node(v, "Div") then
      if isToolbar(v) then
        hasToolbar = true
        break
      end
    end
  end
  return hasToolbar
end

local function hasChildToolbar(el)
  -- force the global orientation to columns if there is a toolbar present
  local hasToolbar = false
  local elType = pandoc.utils.type(el)
  if elType == "Pandoc" then
    hasToolbar = toolbarInContents(el.blocks)
  else
    hasToolbar = toolbarInContents(el.content)
  end
  return hasToolbar
end

local function setPositionEnd(options)
  options[kToolbarPositionAttr] = kToolbarPositionEnd
end

return {
  isToolbar = isToolbar,
  readOptions = readOptions,
  makeToolbar = makeToolbar,
  pageToolbarPlaceholder = pageToolbarPlaceholder,
  hasChildToolbar = hasChildToolbar,
  setPositionEnd = setPositionEnd
}


