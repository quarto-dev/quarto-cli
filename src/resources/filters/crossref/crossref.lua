-- crossref.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- required modules
text = require 'text'

-- global crossref state
crossref = {
  usingTheorems = false
}

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
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
import("qmd.lua")
import("refs.lua")
import("meta.lua")
import("format.lua")
import("options.lua")
import("../common/lunacolors.lua")
import("../common/log.lua")
import("../common/pandoc.lua")
import("../common/format.lua")
import("../common/params.lua")
import("../common/base64.lua")
import("../common/options.lua")
import("../common/refs.lua")
import("../common/filemetadata.lua")
import("../common/figures.lua")
import("../common/tables.lua")
import("../common/theorems.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/string.lua")
import("../common/debug.lua")
-- [/import]

initParams()
initIndex()

-- chain of filters
return {
  initCrossrefOptions(),
  preprocess(),
  combineFilters({
    fileMetadata(),
    sections(),
    figures(),
    tables(),
    equations(),
    listings(),
    theorems(),
    qmd()
  }),
  resolveRefs(),
  crossrefMetaInject(),
  writeIndex()
}

