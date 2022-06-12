-- resourceRefs.lua
-- Copyright (C) 2020 by RStudio, PBC

function resourceRefs() 
  
  -- for docx single single file books we've already processed the refs
  -- as part of a workaround for this issue https://github.com/jgm/pandoc/issues/8099
  if param("single-file-book", false) and _quarto.format.isDocxOutput() then
    return {}
  end

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
  if _quarto.format.isRawHtml(el) then
    local file = currentFileMetadataState().file
    if file ~= nil and file.resourceDir ~= nil then
      handlePaths(el, file.resourceDir, resourceRef)
      return el
    end
  end
end
