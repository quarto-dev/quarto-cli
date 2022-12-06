-- authors.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

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
import("../common/citations.lua")
import("../common/license.lua")
-- [/import]

return {
  {
    Meta = function(meta)
      -- normalizes the author/affiliation metadata
      local normalized = processAuthorMeta(meta)

      -- normalizes the citation metadata
      normalized = processCitationMeta(normalized)

      -- normalizes the license metadata
      normalized = processLicenseMeta(normalized)

      -- for JATs, forward keywords or categories to tags
      if _quarto.format.isJatsOutput() then
        if normalized.tags == nil then
          if normalized.keywords ~= nil then
            normalized.tags = normalized.keywords
          elseif meta.categories ~= nil then
            normalized.tags = normalized.categories
          end
        end
      end

      return normalized
    end
  }
}

