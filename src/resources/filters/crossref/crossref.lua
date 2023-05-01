-- crossref.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- this is the standalone version of our crossref filters, used in the IDEs for auto-completion

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- global crossref state
crossref = {
  usingTheorems = false,
  startAppendix = nil,
  -- initialize autolabels table
  autolabels = pandoc.List()
}

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end
import("../common/apishim.lua")

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

-- note that the apishim.lua import should _not_ happen on main.lua

initCrossrefIndex()

-- chain of filters
return {
  init_crossref_options(),
  crossrefPreprocess(),
  crossrefPreprocessTheorems(),
  combineFilters({
    fileMetadata(),
    qmd(),
    sections(),
    crossrefFigures(),
    crossrefTables(),
    equations(),
    listings(),
    crossrefTheorems(),
  }),
  resolveRefs(),
  crossrefMetaInject(),
  writeIndex()
}