-- authors.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- global state
authorsState = {}

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end

import("../common/pandoc.lua")
import("../common/string.lua")
import("../common/table.lua")
import("../common/lunacolors.lua")
import("../common/log.lua")
import("../common/base64.lua")
import("../common/meta.lua")
import("../common/debug.lua")
import("../common/authors.lua")
-- [/import]

function authorsFilter()
  return {
    Meta = function(meta)
      return processAuthorMeta(meta)
    end
  }
end
