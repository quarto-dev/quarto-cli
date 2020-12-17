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
  local sep = package.config:sub(1,1)
  script = string.gsub(script, "/", sep)
  local path = PANDOC_SCRIPT_FILE:match("(.*" .. sep .. ")")
  dofile(path .. script)
end
import("index.lua")
import("preprocess.lua")
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
import("../common/refs.lua")
import("../common/figures.lua")
import("../common/figures2.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/debug.lua")
-- [/import]

-- chain of filters
return {
  initParams(),
  initOptions(),
  initIndex(),
  preprocess(),
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

