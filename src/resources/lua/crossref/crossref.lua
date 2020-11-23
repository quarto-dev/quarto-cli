
-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*/)")
  dofile(path .. script)
end
-- [/import]

-- global crossref state
crossref = {}

-- lua modules
text = require 'text'

-- imports
import("index.lua")
import("figure.lua")
import("table.lua")
import("refs.lua")
import("format.lua")
import("options.lua")
import("utils.lua")

-- Crossrefs are resolved in a two pass filter:
--
--  1) Process all blocks looking for crossref targets, provide each one
--     with the appropriate caption prefix, and record it in our index
--
--  2) Process all cite elements, resolving them as crossrefs if they
--     have matching keys in the index
--
return {
  {
    Pandoc = function(doc)
      -- initialize submodules
      indexInit()
      optionsInit(doc.meta)

      -- process various types of crossrefs
      processFigures(doc)
      processTables(doc)

      -- return processed doc
      return doc
    end
  },
  {
    Cite = resolveRefs
  }
}





