-- quarto-init.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end
import("../common/pandoc.lua")
import("../common/base64.lua")
import("../common/paths.lua")
import("../common/filemetadata.lua")
import("../common/meta.lua")
import("includes.lua")
import("resourcerefs.lua")

-- [/import]

return {
  {
    Meta = read_includes
  },
  -- read_includes(),
  combineFilters({
    file_metadata(),
    resourceRefs()
  })
}


