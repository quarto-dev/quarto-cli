-- layout.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- Layout classes
local kRowsClz = {"rows"}
local kColumnsClz = {"columns"}
local kLayoutFillClz = "fill"

local function makeRows(content, fill)
  local clz = pandoc.List(kRowsClz)
  if fill ~= false then
    clz:insert(kLayoutFillClz)
  end
  return pandoc.Div(content, pandoc.Attr("", clz))
end

local function makeCols(content, fill) 
  local clz = pandoc.List(kColumnsClz)
  if fill ~= false then
    clz:insert(kLayoutFillClz)
  end
  return pandoc.Div(content, pandoc.Attr("", clz))
end


return {
  makeRows = makeRows,
  makeCols = makeCols
}