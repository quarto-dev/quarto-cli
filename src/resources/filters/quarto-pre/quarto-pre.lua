-- quarto-pre.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.11.2'

-- required modules
text = require 'text'

-- global state
preState = {}

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*/)")
  dofile(path .. script)
end
import("includes.lua")
import("outputs.lua")
import("figures.lua")
import("meta.lua")
import("../common/params.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/pandoc.lua")
import("../common/layout.lua")
import("../common/refs.lua")
import("../common/figures.lua")
import("../common/debug.lua")
-- [/import]


return {
  initParams(),
  readIncludes(),
  combineFilters({
    outputs(),
    figures()
  }),
  metaInject()
}



