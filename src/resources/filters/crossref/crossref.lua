-- crossref.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required modules
text = require 'text'

-- global crossref state
crossref = {}

-- [import]
function import(script)
  -- The system separator
  local pathseparator = package.config:sub(1,1)
  
  -- convert our import to use the current system sep
  local safeScript = string.gsub(script, "/", "\\")
  
  local path = PANDOC_SCRIPT_FILE:match("(.*" .. pathseparator .. ")")
  dofile(path .. safeScript)
end
import("index.lua")
import("sections.lua")
import("figures.lua")
import("tables.lua")
import("equations.lua")
import("listings.lua")
import("theorems.lua")
import("refs.lua")
import("meta.lua")
import("format.lua")
import("options.lua")
import("../common/pandoc.lua")
import("../common/figures.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/debug.lua")
-- [/import]

-- chain of filters
return {
  initOptions(),
  initIndex(),
  labelSubfigures(),
  combineFilters({
    sections(),
    figures(),
    tables(),
    equations(),
    listings(),
    theorems()
  }),
  resolveRefs(),
  metaInject(),
}

