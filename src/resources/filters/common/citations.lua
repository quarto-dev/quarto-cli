-- citation.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- read and replace the citation field
-- with reshaped data that has been 
-- restructured into the standard has
-- format

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
    local citationMeta = meta[_quarto.modules.constants.kCitation]
    if citationMeta and type(citationMeta) == "object" then
      local containerIds = citationMeta[_quarto.modules.constants.kContainerId]
      if containerIds ~= nil then
        meta[_quarto.modules.constants.kCitation][_quarto.modules.constants.kContainerId] = normalizeTypedId(containerIds)
      end

      local articleIds = citationMeta[_quarto.modules.constants.kArticleId]
      if articleIds ~= nil then
        meta[_quarto.modules.constants.kCitation][_quarto.modules.constants.kArticleId] = normalizeTypedId(articleIds)
      end

      if citationMeta[_quarto.modules.constants.kPage] and citationMeta[_quarto.modules.constants.kPageFirst] == nil and citationMeta[_quarto.modules.constants.kPageLast] == nil then
        local pagerange = split(pandoc.utils.stringify(citationMeta[_quarto.modules.constants.kPage]), '-')
        meta[_quarto.modules.constants.kCitation][_quarto.modules.constants.kPageFirst] = pandoc.Inlines(pagerange[1])
        if pagerange[2] then
          meta[_quarto.modules.constants.kCitation][_quarto.modules.constants.kPageLast] = pandoc.Inlines(pagerange[2])
        end
      end
    end
    return meta
  end
end

