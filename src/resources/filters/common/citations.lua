-- citation.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- read and replace the citation field
-- with reshaped data that has been 
-- restructured into the standard has
-- format

local constants = require("modules/constants")

local function processTypedId(el) 
  if pandoc.utils.type(el) == "Inlines" then
    return { value = el }
  else
    return el    
  end
end

local function normalizeTypedId(els)
  if pandoc.utils.type(els) == "List" then
    -- this is a list of ids
    local normalizedEls = {}
    for i,v in ipairs(els) do        
      local normalized = processTypedId(v)
      tappend(normalizedEls, {normalized})
    end
    return normalizedEls
  elseif pandoc.utils.type(els) == "Inlines" then
    -- this is a simple id (a string)
    return { processTypedId(els )}
  else
    -- this is a single id, but is already a typed id
    return { processTypedId(els) }
  end
end

function processCitationMeta(meta)
  if meta then
    local citationMeta = meta[constants.kCitation]
    if citationMeta and type(citationMeta) == "object" then
      local containerIds = citationMeta[constants.kContainerId]
      if containerIds ~= nil then
        meta[constants.kCitation][constants.kContainerId] = normalizeTypedId(containerIds)
      end

      local articleIds = citationMeta[constants.kArticleId]
      if articleIds ~= nil then
        meta[constants.kCitation][constants.kArticleId] = normalizeTypedId(articleIds)
      end

      if citationMeta[constants.kPage] and citationMeta[constants.kPageFirst] == nil and citationMeta[constants.kPageLast] == nil then
        local pagerange = split(pandoc.utils.stringify(citationMeta[constants.kPage]), '-')
        meta[constants.kCitation][constants.kPageFirst] = pandoc.Inlines(pagerange[1])
        if pagerange[2] then
          meta[constants.kCitation][constants.kPageLast] = pandoc.Inlines(pagerange[2])
        end
      end
    end
    return meta
  end
end

