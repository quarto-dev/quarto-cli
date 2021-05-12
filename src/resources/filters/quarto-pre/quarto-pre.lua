-- quarto-pre.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- required modules
text = require 'text'

-- global state
preState = {
  usingTikz = false,
  results = {
    resourceFiles = pandoc.List:new({})
  },
  file = nil,
  appendix = false
}

-- [import]
function import(script)
  local PATH_SEP = package.config:sub(1,1)
  local path = PANDOC_SCRIPT_FILE:match("(.*"..PATH_SEP..")")
  dofile(path .. script)
end
import("includes.lua")
import("outputs.lua")
import("figures.lua")
import("theorems.lua")
import("resourcerefs.lua")
import("book-numbering.lua")
import("meta.lua")
import("tabset.lua")
import("callout.lua")
import("../common/colors.lua")
import("../common/params.lua")
import("../common/base64.lua")
import("../common/json.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/pandoc.lua")
import("../common/filemetadata.lua")
import("../common/layout.lua")
import("../common/refs.lua")
import("../common/figures.lua")
import("../common/theorems.lua")
import("../common/debug.lua")
-- [/import]

initParams()

return {
  readIncludes(),
  outputs(),
  combineFilters({
    fileMetadata(),
    bookNumbering(),
    resourceRefs(),
    figures(),
    theorems(),
    callout(),
    tabset()
  }),
  quartoPreMetaInject(),
}



