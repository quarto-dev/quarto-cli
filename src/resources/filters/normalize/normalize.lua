-- normalize.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

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
local shortcode_ast = require 'modules/astshortcode'

function normalize_filter() 
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

      -- parses the shortcodes that might be in the metadata
      -- since they're not visible in the text that is available
      -- to qmd-reader.lua

      normalized = shortcode_ast.parse(normalized)

      return normalized
    end
  }
end

