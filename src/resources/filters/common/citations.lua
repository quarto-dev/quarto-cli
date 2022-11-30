-- citation.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- read and replace the citation field
-- with reshaped data that has been 
-- restructured into the standard has
-- format

local kCitation = "citation"
local kContainerId = "container-id"
local kArticleId = "article-id"


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
    return { processTypedId(els)}
  end
end

function processCitationMeta(meta)
  local citationMeta = meta[kCitation]
  if citationMeta then

    local containerIds = citationMeta[kContainerId]
    if containerIds ~= nil then
      meta[kCitation][kContainerId] = normalizeTypedId(containerIds)
    end

    local articleIds = citationMeta[kArticleId]
    if articleIds ~= nil then
      meta[kCitation][kArticleId] = normalizeTypedId(articleIds)
    end
    return meta
  else
    return nil
  end
end

