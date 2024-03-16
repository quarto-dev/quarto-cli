-- crossref-standalone.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'


-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end

-- FIXME: needs updating for float-reftargets branch.

import("../mainstateinit.lua")
import("index.lua")
import("preprocess.lua")
import("sections.lua")
import("figures.lua")
import("tables.lua")
import("equations.lua")
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

initCrossrefIndex()

-- chain of filters
return {
  init_crossref_options(),
  crossref_mark_subfloats(),
  crossref_preprocess_theorems(),
  combineFilters({
    file_metadata(),
    qmd(),
    sections(),
    crossref_figures(),
    crossref_tables(),
    equations(),
    crossref_theorems(),
  }),
  resolveRefs(),
  crossrefMetaInject(),
  writeIndex()
}