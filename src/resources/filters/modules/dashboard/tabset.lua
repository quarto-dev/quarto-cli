-- tabset.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- Tabset classes
local kTabsetClass = "tabset"
local kTabClass = "tab"

local function isTabset(el)
  return (el.t == "Div" or el.t == "Header") and el.classes:includes(kTabsetClass)
end

local function readOptions(el)
  return {}, {}
end

local function makeTabset(title, contents, userClasses, options)
  return pandoc.Div(contents, pandoc.Attr("", {"COOL_BEANS"}, {}))
end

return {
  isTabset = isTabset,
  readOptions = readOptions,
  makeTabset = makeTabset

}

