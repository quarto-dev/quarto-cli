-- quarto-post.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.11.2'

-- required modules
text = require 'text'

-- global state
postState = {}

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*/)")
  dofile(path .. script)
end
import("latexdiv.lua")
import("foldcode.lua")
import("meta.lua")
import("../common/params.lua")
import("../common/table.lua")
import("../common/pandoc.lua")
import("../common/figures.lua")
import("../common/meta.lua")
import("../common/debug.lua")
-- [/import]


return {
  initParams(),
  combineFilters({
    latexDiv(),
    foldCode()
  }),
  quartoPostMetaInject()
}



