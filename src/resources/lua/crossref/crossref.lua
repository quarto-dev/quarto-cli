
-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*/)")
  dofile(path .. script)
end
-- [/import]

-- global crossref state
crossref = {}

-- imports
import("figure.lua")
import("index.lua")
import("format.lua")
import("options.lua")
import("utils.lua")


function Pandoc(doc)

  -- initialize submodules
  indexInit()
  optionsInit(doc.meta)

  processFigures(doc)

  return doc
end





