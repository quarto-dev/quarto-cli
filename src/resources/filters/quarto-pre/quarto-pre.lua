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
    resourceFiles = pandoc.List({})
  },
  file = nil,
  appendix = false,
  fileSectionIds = {}
}


-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end
import("../common/colors.lua")
import("../common/params.lua")
import("../common/error.lua")
import("../common/base64.lua")
import("../common/json.lua")
import("../common/latex.lua")
import("../common/meta.lua")
import("../common/options.lua")
import("../common/table.lua")
import("../common/pandoc.lua")
import("../common/filemetadata.lua")
import("../common/layout.lua")
import("../common/refs.lua")
import("../common/figures.lua")
import("../common/tables.lua")
import("../common/theorems.lua")
import("../common/debug.lua")
import("../common/format.lua")
import("../common/string.lua")
import("../common/list.lua")
import("../common/lunacolors.lua")
import("../common/log.lua")
import("../common/url.lua")
import("results.lua")
import("includes.lua")
import("options.lua")
import("shortcodes.lua")
import("shortcodes-handlers.lua")
import("outputs.lua")
import("figures.lua")
import("table-rawhtml.lua")
import("table-captions.lua")
import("table-colwidth.lua")
import("theorems.lua")
import("resourcerefs.lua")
import("resourcefiles.lua")
import("book-numbering.lua")
import("book-links.lua")
import("meta.lua")
import("callout.lua")
import("engine-escape.lua")
import("panel-sidebar.lua")
import("panel-tabset.lua")
import("panel-input.lua")
import("panel-layout.lua")
import("hidden.lua")
import("line-numbers.lua")
import("output-location.lua")
-- [/import]

initParams()

return {
  readIncludes(),
  initOptions(),
  shortCodes(),  
  tableRawhtml(),
  tableColwidthCell(),
  tableColwidth(),
  hidden(),
  outputs(),
  outputLocation(),
  combineFilters({
    fileMetadata(),
    indexBookFileTargets(),
    bookNumbering(),
    resourceRefs(),
    resourceFiles(),
    figures(),
    tableCaptions(),
    theorems(),
    callout(),
    lineNumbers(),
    engineEscape(),
    panelInput(),
    panelTabset(),
    panelLayout(),
    panelSidebar(),
  }),
  combineFilters({
    fileMetadata(),
    resolveBookFileTargets(),
  }),
  quartoPreMetaInject(),
  writeResults()
}



