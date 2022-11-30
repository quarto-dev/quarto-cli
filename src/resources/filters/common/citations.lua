-- citation.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- read and replace the citation field
-- with reshaped data that has been 
-- restructured into the standard has
-- format

local kCitation = "citation"
local kContainerId = "container-id"


local function processContainerId(containerId) 
  if pandoc.utils.type(containerId) == "Inlines" then
    return { value = containerId }
  else
    return containerId    
  end
end

function processCitationMeta(meta)
  local citationMeta = meta[kCitation]
  if citationMeta then

    local containerIds = citationMeta[kContainerId]
    if pandoc.utils.type(containerIds) == "List" then
      -- this is a list of container id
      local normalizedContainerIds = {}
      for i,v in ipairs(containerIds) do        
        local normalized = processContainerId(v)
        tappend(normalizedContainerIds, {normalized})
      end
      meta[kCitation][kContainerId] = normalizedContainerIds
    elseif pandoc.utils.type(containerIds) == "Inlines" then
      -- this is a simple container-id (a string)
      meta[kCitation][kContainerId] = { processContainerId(containerIds )}
    else
      -- this is a single container-id, but is 'complex'
      meta[kCitation][kContainerId] = { processContainerId(containerIds)}
    end
    return meta
  else
    return nil
  end
end

