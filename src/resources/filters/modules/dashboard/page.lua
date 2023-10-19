-- page.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
local document = require "modules/dashboard/document"

local kPageClass = "dashboard-page"

local kOrientationAttr = "orientation"

local kPageAttr = "data-title"

local function readOptions(el)

  local orientation = el.attributes[kOrientationAttr] or document.orientation;
  return {
    [kOrientationAttr] = orientation
  }
end

local function makePage(headerEl, contents, options) 

  local title = pandoc.utils.stringify(headerEl)
  local classes = pandoc.List({kPageClass})
  local attr = {}
  if title ~= nil then
    attr[kPageAttr] = title
  end
  
  -- forward options onto attributes
  for k, v in pairs(options) do
    attr['data-' .. k] = v
  end

  local pageDiv = pandoc.Div(contents, pandoc.Attr("", classes, attr))
  return pageDiv

end


return {
  readOptions = readOptions,
  makePage = makePage
}