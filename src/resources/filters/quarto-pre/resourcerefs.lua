-- resourceRefs.lua
-- Copyright (C) 2020 by RStudio, PBC

function resourceRefs() 
  return {
    Image = function(el)
      local file = currentFileMetadataState().file
      if file ~= nil and file.resourceDir ~= nil then
        el.src = resourceRef(el.src, file.resourceDir)
      end
      return el
    end,

    RawInline = handleRawElementResourceRef,
    RawBlock = handleRawElementResourceRef,
  }
end

function handleRawElementResourceRef(el)
  if isRawHtml(el) then
    local file = currentFileMetadataState().file
    if file ~= nil and file.resourceDir ~= nil then
      handlePaths(el, file.resourceDir, resourceRef)
      return el
    end
  end
end
