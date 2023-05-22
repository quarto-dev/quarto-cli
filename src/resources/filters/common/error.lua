-- debug.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function fail(message)
  local file = currentFile()
  if file then
    fatal("An error occurred while processing '" .. file .. "':\n" .. message, 4)
  else
    fatal("An error occurred:\n" .. message, 4)
  end
end

function currentFile() 
  -- if we're in a multifile contatenated render, return which file we're rendering
  local fileState = currentFileMetadataState()
  if fileState ~= nil and fileState.file ~= nil and fileState.file.bookItemFile ~= nil then
    return fileState.file.bookItemFile
  elseif fileState ~= nil and fileState.include_directory ~= nil then
    return fileState.include_directory
  else
    -- if we're not in a concatenated scenario, file name doesn't really matter since the invocation is only
    -- targeting a single file
    return nil
  end
end
