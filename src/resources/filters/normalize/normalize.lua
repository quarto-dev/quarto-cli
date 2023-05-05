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

-- [/import]

-- imported elements
local authors = require 'modules/authors'
local license = require 'modules/license'

function normalizeFilter() 
  return {
    Meta = function(meta)
      -- normalizes the author/affiliation metadata
      local normalized = authors.processAuthorMeta(meta)

      -- normalizes the citation metadata
      normalized = processCitationMeta(normalized)

      -- normalizes the license metadata
      normalized = license.processLicenseMeta(normalized)

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
end

