-- crossref.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.11.2'

-- required modules
text = require 'text'

-- global crossref state
crossref = {}

-- [import]
function import(script)
  -- The system separator
  local pathseparator = package.config:sub(1,1)
  
  -- convert our import to use the current system sep
  local safeScript = string.gsub(script, "/", pathseparator)
  
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
import("../common/format.lua")
import("../common/params.lua")
import("../common/options.lua")
import("../common/layout.lua")
import("../common/figures.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/debug.lua")
-- [/import]

-- chain of filters
return {
  initParams(),
  initOptions(),
  initIndex(),
  preprocessFigures(true),
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

