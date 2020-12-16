-- quarto.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.11.2'

-- required modules
text = require 'text'

-- [import]
function import(script)
  -- The system separator
  local pathseparator = package.config:sub(1,1)
  
  -- convert our import to use the current system sep
  local safeScript = string.gsub(script, "/", pathseparator)
  
  local path = PANDOC_SCRIPT_FILE:match("(.*" .. pathseparator .. ")")
  dofile(path .. safeScript)
end
import("outputs.lua")
import("latexdiv.lua")
import("../common/params.lua")
import("../common/meta.lua")
import("../common/table.lua")
import("../common/pandoc.lua")
import("../common/figures.lua")
import("../common/debug.lua")
-- [/import]


-- chain of filters
return {
  initParams(),
  combineFilters({
    latexDiv(),
    outputs()
  })
}


